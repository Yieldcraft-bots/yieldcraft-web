// src/app/api/coinbase/balances/route.ts
// Authenticated Coinbase balances endpoint (multi-user + product-scoped)
// Reads user's stored keys from public.coinbase_keys and returns USD/USDC + BTC balances + equity
//
// NOTE:
// - Uses Authorization: Bearer <supabase_access_token>
// - Verifies user via Supabase auth (anon client)
// - Reads keys & writes snapshot via Supabase SERVICE ROLE (server-only)
// - Does NOT place orders. Read-only.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductScope = "pulse" | "atlas";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeScope(v: string | null): ProductScope {
  return v?.toLowerCase() === "atlas" ? "atlas" : "pulse";
}

// Coinbase CDP JWT: uri = "METHOD api.coinbase.com<PATH>"
function buildCdpJwt(
  apiKeyName: string,
  privateKeyPem: string,
  method: "GET" | "POST",
  path: string,
  alg: "ES256" | "EdDSA" = "ES256"
) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKeyPem as any,
    {
      algorithm: alg as any,
      header: { kid: apiKeyName, nonce } as any,
    } as any
  );
}

async function coinbaseGet(
  apiKeyName: string,
  privateKeyPem: string,
  path: string,
  alg: "ES256" | "EdDSA" = "ES256"
) {
  const token = buildCdpJwt(apiKeyName, privateKeyPem, "GET", path, alg);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);
  return { ok: res.ok, status: res.status, json: parsed, text };
}

async function fetchBtcSpotUsd(): Promise<number> {
  const r = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`btc_spot_http_${r.status}`);
  const j = await r.json().catch(() => null);
  const p = Number(j?.data?.amount);
  if (!Number.isFinite(p) || p <= 0) throw new Error("btc_spot_parse_failed");
  return p;
}

export async function GET(req: Request) {
  try {
    const accessToken = getBearer(req);
    if (!accessToken) {
      return json(401, { ok: false, error: "Not authenticated" });
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon) {
      return json(500, {
        ok: false,
        error: "Missing Supabase env",
        details: { url: !!url, anon: !!anon },
      });
    }
    if (!service) {
      return json(500, {
        ok: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY (server-only)",
      });
    }

    const reqUrl = new URL(req.url);
    const productScope = normalizeScope(reqUrl.searchParams.get("product"));

    // 1) Verify user
    const supaAuth = createClient(url, anon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userErr } = await supaAuth.auth.getUser();
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return json(401, {
        ok: false,
        error: "Not authenticated",
        details: userErr?.message || "no_user",
      });
    }

    // 2) Read product-scoped keys using service role
    const supa = createClient(url, service, {
      auth: { persistSession: false },
    });

    const { data: keys, error: keysErr } = await supa
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at, product_scope")
      .eq("user_id", userId)
      .eq("product_scope", productScope)
      .maybeSingle();

    if (keysErr) {
      return json(200, {
        ok: false,
        error: "keys_lookup_failed",
        product_scope: productScope,
        details: keysErr.message,
      });
    }

    if (!keys?.api_key_name || !keys?.private_key) {
      return json(200, {
        ok: false,
        error: "no_keys",
        product_scope: productScope,
      });
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(String(keys.private_key));
    const alg: "ES256" | "EdDSA" =
      String(keys.key_alg || "ES256").toUpperCase() === "EDDSA"
        ? "EdDSA"
        : "ES256";

    // 3) Fetch brokerage accounts
    const acct = await coinbaseGet(
      apiKeyName,
      privateKeyPem,
      "/api/v3/brokerage/accounts",
      alg
    );

    if (!acct.ok) {
      return json(200, {
        ok: false,
        error: "coinbase_accounts_failed",
        product_scope: productScope,
        status: acct.status,
        details: acct.json ?? acct.text,
      });
    }

    const accounts = (acct.json as any)?.accounts || [];

    const usd = accounts.find((a: any) => a?.currency === "USD");
    const usdc = accounts.find((a: any) => a?.currency === "USDC");
    const btc = accounts.find((a: any) => a?.currency === "BTC");

    const usdAvailable = num(usd?.available_balance?.value, 0);
    const usdcAvailable = num(usdc?.available_balance?.value, 0);
    const cashAvailable = usdAvailable + usdcAvailable;

    const btcAvailable = num(btc?.available_balance?.value, 0);

    // 4) Fetch BTC price
    let btcPrice = 0;
    try {
      btcPrice = await fetchBtcSpotUsd();
    } catch {
      const ticker = await coinbaseGet(
        apiKeyName,
        privateKeyPem,
        "/api/v3/brokerage/products/BTC-USD/ticker",
        alg
      );
      if (ticker.ok) btcPrice = num((ticker.json as any)?.price, 0);
    }

    const equityUsd = cashAvailable + btcAvailable * btcPrice;
    const nowIso = new Date().toISOString();

    // 5) Best-effort snapshot write
    // If your table is only one row per user, this may overwrite.
    // That is okay for now because this route remains read-only and UI-safe.
    try {
      await supa.from("user_account_snapshot").upsert(
        {
          user_id: userId,
          exchange: `coinbase_${productScope}`,
          equity_usd: equityUsd,
          available_usd: cashAvailable,
          btc_balance: btcAvailable,
          btc_price_usd: btcPrice,
          last_checked_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id,exchange" }
      );
    } catch {
      // ignore snapshot issues
    }

    return json(200, {
      ok: true,
      exchange: "coinbase",
      product_scope: productScope,
      available_usd: cashAvailable,
      btc_balance: btcAvailable,
      btc_price_usd: btcPrice,
      equity_usd: equityUsd,
      last_checked_at: nowIso,
      alg,
      cash_breakdown: {
        usd_available: usdAvailable,
        usdc_available: usdcAvailable,
      },
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: "server_error",
      details: err?.message || String(err),
    });
  }
}