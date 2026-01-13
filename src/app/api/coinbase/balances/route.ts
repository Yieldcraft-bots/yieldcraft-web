// src/app/api/coinbase/balances/route.ts
// Coinbase balances + equity snapshot (multi-user)
// Auth: Supabase access token in Authorization: Bearer <token>
// Keys: stored per-user in public.coinbase_keys (api_key_name, private_key, key_alg)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- tiny helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizePem(pem: string) {
  let p = String(pem || "").trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  // handle env-style escaped newlines + windows newlines
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coalesceAccounts(payload: any): any[] {
  // Coinbase AT usually returns { accounts: [...] }
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function pickCurrencyCode(a: any): string {
  return String(
    a?.currency ??
      a?.available_balance?.currency ??
      a?.balance?.currency ??
      a?.hold?.currency ??
      ""
  ).toUpperCase();
}

function pickAvailableValue(a: any): number {
  const v =
    a?.available_balance?.value ??
    a?.available_balance ??
    a?.balance?.value ??
    a?.balance ??
    a?.available ??
    "0";
  return asNum(v);
}

// ---------- CDP JWT signer (matches your working pulse-trade) ----------
function buildCdpJwt(opts: {
  apiKeyName: string;
  privateKeyPem: string;
  alg: "ES256" | "EdDSA";
  method: "GET" | "POST";
  path: string; // "/api/v3/brokerage/accounts"
}) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${opts.method} api.coinbase.com${opts.path}`;

  // IMPORTANT:
  // - iss MUST be "cdp"
  // - sub must be apiKeyName
  // - header kid must be apiKeyName
  // - header nonce required
  return jwt.sign(
    { iss: "cdp", sub: opts.apiKeyName, nbf: now, exp: now + 60, uri },
    opts.privateKeyPem as any,
    { algorithm: opts.alg, header: { kid: opts.apiKeyName, nonce } as any }
  );
}

async function coinbaseGet(jwtToken: string, path: string) {
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwtToken}` },
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = safeJsonParse(text);
  return { ok: res.ok, status: res.status, json: parsed, text };
}

// ---------- route ----------
export async function GET(req: Request) {
  try {
    // 1) Require user session (multi-user)
    const token = getBearer(req);
    if (!token) return json(401, { ok: false, error: "Not authenticated" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) return json(500, { ok: false, error: "server_misconfigured" });

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Resolve user id from bearer token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (userErr || !userId) return json(401, { ok: false, error: "Not authenticated" });

    // 3) Load this user's Coinbase key
    const { data: keys, error: keyErr } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyErr || !keys?.api_key_name || !keys?.private_key) {
      return json(200, { ok: false, error: "no_keys" });
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(String(keys.private_key));
    const algRaw = String(keys.key_alg || "ES256").trim();
    const alg: "ES256" | "EdDSA" = algRaw.toUpperCase() === "EDDSA" ? "EdDSA" : "ES256";

    // 4) Fetch accounts (this is what was 401'ing)
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt1 = buildCdpJwt({
      apiKeyName,
      privateKeyPem,
      alg,
      method: "GET",
      path: accountsPath,
    });

    const acct = await coinbaseGet(jwt1, accountsPath);
    if (!acct.ok) {
      return json(200, {
        ok: false,
        error: "coinbase_accounts_failed",
        status: acct.status,
        details: acct.json ?? acct.text,
        alg,
        api_key_name_last4: apiKeyName.slice(-4),
      });
    }

    const accounts = coalesceAccounts(acct.json);

    // 5) Compute balances (best-effort)
    let usdAvailable = 0;
    let btcAvailable = 0;

    for (const a of accounts) {
      const c = pickCurrencyCode(a);
      const v = pickAvailableValue(a);
      if (c === "USD") usdAvailable += v;
      if (c === "BTC") btcAvailable += v;
    }

    // 6) Fetch BTC-USD price (best-effort)
    const productPath = "/api/v3/brokerage/products/BTC-USD";
    const jwt2 = buildCdpJwt({
      apiKeyName,
      privateKeyPem,
      alg,
      method: "GET",
      path: productPath,
    });

    const prod = await coinbaseGet(jwt2, productPath);
    let btcPrice = 0;
    if (prod.ok) {
      const p =
        prod.json?.price ??
        prod.json?.product?.price ??
        prod.json?.data?.price ??
        prod.json?.products?.[0]?.price ??
        "0";
      btcPrice = asNum(p);
    }

    const equityUsd = usdAvailable + btcAvailable * btcPrice;

    // 7) Optional snapshot write (won't break balances if table missing)
    const nowIso = new Date().toISOString();
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
        // If your table uses a different conflict target, change this to match.
        { onConflict: "user_id" }
      );
    } catch {
      // ignore snapshot errors (balances must still work)
    }

    // 8) Return
    return json(200, {
      ok: true,
      exchange: "coinbase",
      alg,
      available_usd: usdAvailable,
      btc_balance: btcAvailable,
      btc_price_usd: btcPrice,
      equity_usd: equityUsd,
      last_checked_at: nowIso,
    });
  } catch (err: any) {
    return json(500, { ok: false, error: "server_error", details: err?.message || String(err) });
  }
}
