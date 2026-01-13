// src/app/api/coinbase/balances/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -------------------- auth helpers --------------------

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizePem(pem: string) {
  return String(pem || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj)));
}

// -------------------- Coinbase JWT (ES256) --------------------
// Coinbase AT expects:
// header: { alg:"ES256", kid:<apiKeyName>, nonce:<hex>, typ:"JWT" }
// payload: { iss:"cdp", nbf, exp, uri:"METHOD api.coinbase.com/PATH" }

function buildCdpJwtES256(opts: {
  apiKeyName: string;
  privateKeyPem: string;
  method: "GET" | "POST";
  path: string; // e.g. "/api/v3/brokerage/accounts"
}) {
  const apiKeyName = String(opts.apiKeyName || "").trim();
  const privateKeyPem = normalizePem(String(opts.privateKeyPem || ""));

  if (!apiKeyName) throw new Error("missing_api_key_name");
  if (!privateKeyPem) throw new Error("missing_private_key");

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const header = {
    alg: "ES256",
    kid: apiKeyName,
    nonce,
    typ: "JWT",
  };

  const payload = {
    iss: "cdp",
    nbf: now,
    exp: now + 60,
    uri: `${opts.method} api.coinbase.com${opts.path}`,
  };

  const input = `${b64urlJson(header)}.${b64urlJson(payload)}`;

  // ECDSA P-256 SHA-256
  const sign = crypto.createSign("SHA256");
  sign.update(input);
  sign.end();

  const sig = sign
    .sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" })
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${input}.${sig}`;
}

async function coinbaseFetch(jwt: string, path: string) {
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }

  return { ok: res.ok, status: res.status, json, text };
}

// -------------------- route --------------------

export async function GET(req: Request) {
  try {
    // 1) require bearer (supabase user session token)
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) supabase admin client (service role)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return NextResponse.json(
        { ok: false, error: "server_misconfigured" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3) resolve user from bearer
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;

    if (userErr || !userId) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 4) load THIS USER's coinbase keys
    // Expected table + columns (same pattern as your status endpoint):
    // user_exchange_keys: user_id, exchange, api_key_name, private_key, key_alg
    const { data: keys, error: keyErr } = await admin
      .from("user_exchange_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", userId)
      .eq("exchange", "coinbase")
      .maybeSingle();

    if (keyErr || !keys?.api_key_name || !keys?.private_key) {
      return NextResponse.json(
        { ok: false, error: "no_keys" },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const alg = String(keys.key_alg || "ES256").toUpperCase();
    if (alg.includes("ED25519") || alg.includes("EDDSA")) {
      return NextResponse.json(
        {
          ok: false,
          error: "key_alg_not_supported_yet",
          details: "This balances endpoint currently supports ES256 only.",
          alg,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(String(keys.private_key));

    // 5) fetch accounts
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt1 = buildCdpJwtES256({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: accountsPath,
    });

    const acct = await coinbaseFetch(jwt1, accountsPath);

    if (!acct.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "coinbase_accounts_failed",
          status: acct.status,
          details: acct.json ?? acct.text,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const accounts = (acct.json as any)?.accounts || [];
    const arr: any[] = Array.isArray(accounts) ? accounts : [];

    let usdAvailable = 0;
    let btcAvailable = 0;

    for (const a of arr) {
      const cur = String(a?.currency || "").toUpperCase();
      const v = Number(a?.available_balance?.value ?? 0);

      if (cur === "USD" && Number.isFinite(v)) usdAvailable += v;
      if (cur === "BTC" && Number.isFinite(v)) btcAvailable += v;
    }

    // 6) fetch BTC-USD price (best-effort)
    const productPath = "/api/v3/brokerage/products/BTC-USD";
    const jwt2 = buildCdpJwtES256({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: productPath,
    });

    const prod = await coinbaseFetch(jwt2, productPath);

    const priceRaw =
      (prod.json as any)?.price ??
      (prod.json as any)?.product?.price ??
      (prod.json as any)?.data?.price ??
      "0";

    const btcPrice = Number(priceRaw) || 0;
    const equityUsd = usdAvailable + btcAvailable * btcPrice;

    const nowIso = new Date().toISOString();

    // 7) write snapshot (optional, but useful for sizing)
    // If your table has a different unique constraint, adjust onConflict accordingly.
    try {
      await admin.from("user_account_snapshot").upsert(
        {
          user_id: userId,
          exchange: "coinbase",
          equity_usd: Number.isFinite(equityUsd) ? equityUsd : null,
          available_usd: Number.isFinite(usdAvailable) ? usdAvailable : null,
          btc_balance: Number.isFinite(btcAvailable) ? btcAvailable : null,
          btc_price_usd: Number.isFinite(btcPrice) ? btcPrice : null,
          last_checked_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
    } catch {
      // ignore snapshot errors — balances must still return
    }

    // 8) return
    return NextResponse.json(
      {
        ok: true,
        exchange: "coinbase",
        alg: "ES256",
        available_usd: usdAvailable,
        btc_balance: btcAvailable,
        btc_price_usd: btcPrice,
        equity_usd: equityUsd,
        last_checked_at: nowIso,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
