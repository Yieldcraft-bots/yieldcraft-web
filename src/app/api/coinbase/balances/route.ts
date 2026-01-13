// src/app/api/coinbase/balances/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  return String(pem || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signEs256(input: string, privateKeyPem: string) {
  // ES256 = ECDSA P-256 with SHA-256.
  // Node expects the digest name "SHA256" for ECDSA signing.
  const sign = crypto.createSign("SHA256");
  sign.update(input);
  sign.end();
  return base64url(sign.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" }));
}

function signEdDsa(input: string, privateKeyPem: string) {
  // Ed25519 signing uses EdDSA in Node.
  // Note: createSign is not used for Ed25519; use crypto.sign directly.
  const sig = crypto.sign(null, Buffer.from(input), privateKeyPem);
  return base64url(sig);
}

function buildCoinbaseJwt({
  apiKeyName,
  privateKeyPem,
  method,
  path,
  keyAlg,
}: {
  apiKeyName: string;
  privateKeyPem: string;
  method: string;
  path: string; // e.g. "/api/v3/brokerage/accounts"
  keyAlg?: string | null; // "ES256" | "EdDSA" (Ed25519)
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60;

  const alg = (keyAlg || "ES256").toUpperCase();

  const header: any = {
    alg: alg === "EDDSA" ? "EdDSA" : "ES256",
    kid: apiKeyName,
    nonce: crypto.randomBytes(16).toString("hex"),
    typ: "JWT",
  };

  const payload: any = {
    iss: "cdp",
    nbf: now,
    exp,
    uri: `${method.toUpperCase()} api.coinbase.com${path}`,
  };

  const input = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;

  const signature =
    alg === "EDDSA" ? signEdDsa(input, privateKeyPem) : signEs256(input, privateKeyPem);

  return `${input}.${signature}`;
}

async function coinbaseFetch(jwt: string, path: string, method: "GET" | "POST" = "GET") {
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
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

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve user from Bearer token
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // Load this user's Coinbase keys
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
    const keyAlg = (keys.key_alg ?? "ES256") as string;

    // 1) Fetch accounts
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt1 = buildCoinbaseJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: accountsPath,
      keyAlg,
    });

    const acct = await coinbaseFetch(jwt1, accountsPath, "GET");
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

    // Normalize possible response shapes
    const accounts =
      acct.json?.accounts ??
      acct.json?.data ??
      acct.json?.result ??
      acct.json ??
      [];

    const arr: any[] = Array.isArray(accounts)
      ? accounts
      : Array.isArray(accounts?.accounts)
      ? accounts.accounts
      : [];

    // 2) Parse balances (best effort)
    let usdAvailable = 0;
    let btcBalance = 0;

    for (const a of arr) {
      const currency = String(
        a?.currency ??
          a?.available_balance?.currency ??
          a?.balance?.currency ??
          a?.hold?.currency ??
          ""
      ).toUpperCase();

      const availVal =
        a?.available_balance?.value ??
        a?.available_balance ??
        a?.balance?.value ??
        a?.balance ??
        a?.available ??
        a?.available_value ??
        a?.hold?.value ??
        "0";

      const avail = toNumber(availVal);

      if (currency === "USD") usdAvailable += avail;
      if (currency === "BTC") btcBalance += avail;
    }

    // 3) Fetch BTC-USD price
    const productPath = "/api/v3/brokerage/products/BTC-USD";
    const jwt2 = buildCoinbaseJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: productPath,
      keyAlg,
    });

    const prod = await coinbaseFetch(jwt2, productPath, "GET");

    const priceRaw =
      prod.json?.price ??
      prod.json?.product?.price ??
      prod.json?.data?.price ??
      prod.json?.products?.[0]?.price ??
      prod.json?.result?.price ??
      "0";

    const btcPrice = toNumber(priceRaw);
    const equityUsd = usdAvailable + btcBalance * btcPrice;

    // 4) Upsert snapshot (by user_id + exchange)
    const nowIso = new Date().toISOString();
    const { error: snapErr } = await admin.from("user_account_snapshot").upsert(
      {
        user_id: userId,
        exchange: "coinbase",
        equity_usd: Number.isFinite(equityUsd) ? equityUsd : null,
        available_usd: Number.isFinite(usdAvailable) ? usdAvailable : null,
        btc_balance: Number.isFinite(btcBalance) ? btcBalance : null,
        btc_price_usd: Number.isFinite(btcPrice) ? btcPrice : null,
        last_checked_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id,exchange" }
    );

    if (snapErr) {
      return NextResponse.json(
        { ok: false, error: "snapshot_write_failed", details: snapErr.message },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        exchange: "coinbase",
        equity_usd: equityUsd,
        available_usd: usdAvailable,
        btc_balance: btcBalance,
        btc_price_usd: btcPrice,
        key_alg: keyAlg,
        last_checked_at: nowIso,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
