// src/app/api/coinbase/balances/route.ts
// Authenticated Coinbase balances endpoint (multi-user via Supabase auth token)
// Reads user's stored keys from public.coinbase_keys and returns USD/BTC balances + equity
//
// NOTE:
// - Uses Authorization: Bearer <supabase_access_token>
// - Verifies user via Supabase auth (anon client)
// - Reads keys & writes snapshot via Supabase SERVICE ROLE (server-only) to avoid RLS surprises
// - Does NOT place orders. Read-only.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
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

// Coinbase CDP JWT: uri = "METHOD api.coinbase.com<PATH>"
function buildCdpJwt(apiKeyName: string, privateKeyPem: string, method: "GET" | "POST", path: string) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKeyPem as any,
    {
      algorithm: "ES256",
      header: { kid: apiKeyName, nonce } as any,
    } as any
  );
}

async function coinbaseGet(apiKeyName: string, privateKeyPem: string, path: string) {
  const token = buildCdpJwt(apiKeyName, privateKeyPem, "GET", path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);
  return { ok: res.ok, status: res.status, json: parsed, text };
}

export async function GET(req: Request) {
  try {
    // 1) Require user auth token
    const accessToken = getBearer(req);
    if (!accessToken) return json(401, { ok: false, error: "Not authenticated" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon) {
      return json(500, { ok: false, error: "Missing Supabase env", details: { url: !!url, anon: !!anon } });
    }
    if (!service) {
      // balances will often fail under RLS without service role; make it explicit
      return json(500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY (server-only)" });
    }

    // 2) Verify token -> user
    const supaAuth = createClient(url, anon, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userErr } = await supaAuth.auth.getUser();
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return json(401, { ok: false, error: "Not authenticated", details: userErr?.message || "no_user" });
    }

    // 3) Read keys using service role (safe server-side)
    const supa = createClient(url, service, { auth: { persistSession: false } });

    const { data: keys, error: keysErr } = await supa
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (keysErr) {
      return json(200, { ok: false, error: "keys_lookup_failed", details: keysErr.message });
    }

    if (!keys?.api_key_name || !keys?.private_key) {
      return json(200, { ok: false, error: "no_keys" });
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(String(keys.private_key));

    // 4) Fetch balances
    const acct = await coinbaseGet(apiKeyName, privateKeyPem, "/api/v3/brokerage/accounts");
    if (!acct.ok) {
      return json(200, {
        ok: false,
        error: "coinbase_accounts_failed",
        status: acct.status,
        details: acct.json ?? acct.text,
      });
    }

    const accounts = (acct.json as any)?.accounts || [];
    const usd = accounts.find((a: any) => a?.currency === "USD");
    const btc = accounts.find((a: any) => a?.currency === "BTC");

    const usdAvailable = num(usd?.available_balance?.value, 0);
    const btcAvailable = num(btc?.available_balance?.value, 0);

    // 5) Fetch BTC-USD price (best-effort)
    let btcPrice = 0;
    const ticker = await coinbaseGet(apiKeyName, privateKeyPem, "/api/v3/brokerage/products/BTC-USD/ticker");
    if (ticker.ok) {
      btcPrice = num((ticker.json as any)?.price, 0);
    }

    const equityUsd = usdAvailable + btcAvailable * btcPrice;
    const nowIso = new Date().toISOString();

    // 6) Best-effort snapshot write (does not block balances)
    try {
      await supa
        .from("user_account_snapshot")
        .upsert(
          {
            user_id: userId,
            exchange: "coinbase",
            equity_usd: equityUsd,
            available_usd: usdAvailable,
            btc_balance: btcAvailable,
            btc_price_usd: btcPrice,
            last_checked_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id" }
        );
    } catch {
      // ignore
    }

    // 7) Return
    return json(200, {
      ok: true,
      exchange: "coinbase",
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
