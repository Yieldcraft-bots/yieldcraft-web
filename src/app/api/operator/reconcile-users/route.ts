import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizePem(pem: string) {
  let p = (pem || "").trim();

  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }

  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildCdpJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: "GET",
  path: string,
  alg: "ES256" | "EdDSA" = "ES256"
) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    {
      iss: "cdp",
      sub: apiKeyName,
      nbf: now,
      exp: now + 60,
      uri,
    },
    privateKeyPem as any,
    {
      algorithm: alg as any,
      header: {
        kid: apiKeyName,
        nonce,
      } as any,
    } as any
  );
}

async function coinbaseGet(
  apiKeyName: string,
  privateKeyPem: string,
  path: string,
  alg: "ES256" | "EdDSA" = "ES256"
) {
  const token = buildCdpJwt(
    apiKeyName,
    privateKeyPem,
    "GET",
    path,
    alg
  );

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const text = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    json: safeJsonParse(text),
    text,
  };
}

async function fetchBtcSpotUsd(): Promise<number> {
  const r = await fetch(
    "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    {
      cache: "no-store",
    }
  );

  if (!r.ok) return 0;

  const j = await r.json().catch(() => null);

  return num(j?.data?.amount, 0);
}

export async function GET(req: Request) {
  try {
    const reqUrl = new URL(req.url);

    const token = reqUrl.searchParams.get("token");

    if (!process.env.RECONCILIATION_OPERATOR_TOKEN) {
      return json(500, {
        ok: false,
        error: "missing_RECONCILIATION_OPERATOR_TOKEN",
      });
    }

    if (token !== process.env.RECONCILIATION_OPERATOR_TOKEN) {
      return json(401, {
        ok: false,
        error: "unauthorized",
      });
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL;

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return json(500, {
        ok: false,
        error: "missing_supabase_env",
        details: {
          url: !!url,
          service: !!service,
        },
      });
    }

    const supa = createClient(url, service, {
      auth: {
        persistSession: false,
      },
    });

    const { data: keys, error: keysErr } = await supa
      .from("coinbase_keys")
      .select(
        `
        user_id,
        api_key_name,
        private_key,
        key_alg,
        product_scope,
        updated_at
      `
      )
      .not("api_key_name", "is", null)
      .not("private_key", "is", null)
      .order("updated_at", {
        ascending: false,
      });

    if (keysErr) {
      return json(500, {
        ok: false,
        error: "coinbase_keys_lookup_failed",
        details: keysErr.message,
      });
    }

    const btcPrice = await fetchBtcSpotUsd();

    const results: any[] = [];

    for (const key of keys || []) {
      const userId = String(key.user_id);

      const productScope = String(
        key.product_scope || "pulse"
      ).toLowerCase();

      const exchange = `coinbase_${productScope}`;

      const apiKeyName = String(
        key.api_key_name || ""
      ).trim();

      const privateKeyPem = normalizePem(
        String(key.private_key || "")
      );

      const alg: "ES256" | "EdDSA" =
        String(key.key_alg || "ES256").toUpperCase() === "EDDSA"
          ? "EdDSA"
          : "ES256";

      const acct = await coinbaseGet(
        apiKeyName,
        privateKeyPem,
        "/api/v3/brokerage/accounts",
        alg
      );

      if (!acct.ok) {
        results.push({
          user_id: userId,
          exchange,
          ok: false,
          status: acct.status,
          error: "coinbase_accounts_failed",
        });

        continue;
      }

      const accounts = (acct.json as any)?.accounts || [];

      const usd = accounts.find(
        (a: any) => a?.currency === "USD"
      );

      const usdc = accounts.find(
        (a: any) => a?.currency === "USDC"
      );

      const btc = accounts.find(
        (a: any) => a?.currency === "BTC"
      );

      const usdAvailable = num(
        usd?.available_balance?.value,
        0
      );

      const usdcAvailable = num(
        usdc?.available_balance?.value,
        0
      );

      const btcAvailable = num(
        btc?.available_balance?.value,
        0
      );

      const cashAvailable =
        usdAvailable + usdcAvailable;

      const equityUsd =
        cashAvailable + btcAvailable * btcPrice;

      const nowIso = new Date().toISOString();

      const { error: snapErr } = await supa
        .from("user_account_snapshot")
        .upsert(
          {
            user_id: userId,
            exchange,
            equity_usd: equityUsd,
            available_usd: cashAvailable,
            btc_balance: btcAvailable,
            btc_price_usd: btcPrice,
            last_checked_at: nowIso,
            updated_at: nowIso,
          },
          {
            onConflict: "user_id,exchange",
          }
        );

      results.push({
        user_id: userId,
        exchange,
        ok: !snapErr,
        btc_balance: btcAvailable,
        available_usd: cashAvailable,
        equity_usd: equityUsd,
        snapshot_error: snapErr?.message || null,
      });
    }

    const usersOk = results.filter((r) => r.ok).length;

    const usersFailed = results.filter(
      (r) => !r.ok
    ).length;

    const coinbase401Count = results.filter(
      (r) => r.status === 401
    ).length;

    const { data: insertedRun } = await supa
      .from("reconciliation_runs")
      .insert({
        mode: "read_only_reconciliation_refresh",
        users_checked: results.length,
        users_ok: usersOk,
        users_failed: usersFailed,
        coinbase_401_count: coinbase401Count,
        results,
      })
      .select("id")
      .single();

    const runId = insertedRun?.id || null;

    const failedResults = results.filter(
      (r) => !r.ok
    );

    if (failedResults.length > 0) {
      await supa
        .from("reconciliation_failures")
        .insert(
          failedResults.map((r) => ({
            run_id: runId,
            user_id: r.user_id,
            exchange: r.exchange,
            status: r.status || null,
            error: r.error || r.snapshot_error || "unknown_error",
            details: r,
          }))
        );
    }

    return json(200, {
      ok: true,
      mode: "read_only_reconciliation_refresh",
      users_checked: results.length,
      users_ok: usersOk,
      users_failed: usersFailed,
      coinbase_401_count: coinbase401Count,
      results,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      details: err?.message || String(err),
    });
  }
}