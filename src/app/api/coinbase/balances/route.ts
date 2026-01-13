// src/app/api/coinbase/balances/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizePem(pem: string) {
  let p = String(pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

// CDP JWT builder (matches your working pulse-trade logic)
function buildCdpJwt(opts: {
  apiKeyName: string;
  privateKeyPem: string;
  method: "GET" | "POST";
  path: string; // "/api/v3/brokerage/accounts"
  alg?: "ES256" | "EdDSA";
}) {
  const apiKeyName = opts.apiKeyName.trim();
  const privateKey = normalizePem(opts.privateKeyPem);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${opts.method} api.coinbase.com${opts.path}`;

  const algorithm = opts.alg || "ES256";

  // IMPORTANT:
  // - payload includes: iss=cdp, sub=apiKeyName, nbf/exp, uri
  // - header includes: kid=apiKeyName, nonce
  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKey as any,
    { algorithm: algorithm as any, header: { kid: apiKeyName, nonce } as any }
  );
}

async function coinbaseGet(jwtToken: string, path: string) {
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${jwtToken}` },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep as text
  }

  return { ok: res.ok, status: res.status, json, text };
}

export async function GET(req: Request) {
  try {
    // 1) Require logged-in user (Bearer token from Supabase session)
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // 2) Service role client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3) Resolve userId from Bearer token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // 4) Load this user's Coinbase keys from Supabase
    // Table: coinbase_keys
    // Columns: user_id, api_key_name, private_key, key_alg
    const { data: keys, error: keyErr } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key, key_alg")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyErr || !keys?.api_key_name || !keys?.private_key) {
      return NextResponse.json({ ok: false, error: "no_keys" }, { status: 200 });
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(String(keys.private_key));

    // Optional: support EdDSA if you ever store key_alg = "ed25519" / "EdDSA"
    const rawAlg = String(keys.key_alg || "").toLowerCase();
    const alg: "ES256" | "EdDSA" =
      rawAlg.includes("eddsa") || rawAlg.includes("ed25519") ? "EdDSA" : "ES256";

    // 5) Call Coinbase accounts
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt1 = buildCdpJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: accountsPath,
      alg,
    });

    const acct = await coinbaseGet(jwt1, accountsPath);

    if (!acct.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "coinbase_accounts_failed",
          status: acct.status,
          details: acct.json ?? acct.text,
        },
        { status: 200 }
      );
    }

    // 6) Parse balances (best-effort)
    const accounts = (acct.json as any)?.accounts || [];
    let usdAvailable = 0;
    let btcAvailable = 0;

    for (const a of accounts) {
      const cur = String(a?.currency || "");
      const v = Number(a?.available_balance?.value ?? 0);
      if (!Number.isFinite(v)) continue;
      if (cur === "USD") usdAvailable += v;
      if (cur === "BTC") btcAvailable += v;
    }

    // 7) Fetch BTC-USD price (optional, but useful)
    const productPath = "/api/v3/brokerage/products/BTC-USD";
    const jwt2 = buildCdpJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: productPath,
      alg,
    });

    const prod = await coinbaseGet(jwt2, productPath);
    const btcPrice = Number((prod.json as any)?.price ?? (prod.json as any)?.product?.price ?? 0) || 0;

    const equityUsd = usdAvailable + btcAvailable * btcPrice;

    return NextResponse.json(
      {
        ok: true,
        exchange: "coinbase",
        alg,
        available_usd: usdAvailable,
        btc_balance: btcAvailable,
        btc_price_usd: btcPrice,
        equity_usd: equityUsd,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("coinbase/balances error", err);
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
