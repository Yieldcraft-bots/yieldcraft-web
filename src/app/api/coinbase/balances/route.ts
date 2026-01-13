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

function base64url(obj: any) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Coinbase Advanced Trade (CDP keys) JWT:
 * header: { alg: "ES256", kid: <apiKeyName>, nonce, typ:"JWT" }
 * payload: { iss:"cdp", nbf, exp, uri:"<METHOD> api.coinbase.com<PATH>" }
 */
function buildCoinbaseJwt({
  apiKeyName,
  privateKeyPem,
  method,
  path,
}: {
  apiKeyName: string;
  privateKeyPem: string;
  method: string;
  path: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60;

  const header = {
    alg: "ES256",
    kid: apiKeyName,
    nonce: crypto.randomBytes(16).toString("hex"),
    typ: "JWT",
  };

  const payload = {
    iss: "cdp",
    nbf: now,
    exp,
    uri: `${method.toUpperCase()} api.coinbase.com${path}`,
  };

  const input = `${base64url(header)}.${base64url(payload)}`;

  // ✅ Normalize + convert SEC1 "BEGIN EC PRIVATE KEY" -> PKCS8 if needed
  const keyObj = crypto.createPrivateKey(normalizePem(privateKeyPem));
  const pkcs8Pem = keyObj.export({ format: "pem", type: "pkcs8" }) as string;

  // ✅ Correct signer for ES256
  const sign = crypto.createSign("SHA256");
  sign.update(input);
  sign.end();

  const signature = sign
    .sign({ key: pkcs8Pem, dsaEncoding: "ieee-p1363" })
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${input}.${signature}`;
}

async function coinbaseFetch(jwt: string, path: string) {
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // leave json null, keep text
  }

  return { ok: res.ok, status: res.status, json, text };
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
    const privateKeyPem = String(keys.private_key);

    // 1) Accounts (balances)
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt1 = buildCoinbaseJwt({
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
        { status: 200 }
      );
    }

    const accounts = acct.json?.accounts || acct.json?.data || acct.json;
    const arr = Array.isArray(accounts) ? accounts : [];

    let usdAvailable = 0;
    let btcBalance = 0;

    for (const a of arr) {
      const currency = (
        a?.currency ||
        a?.available_balance?.currency ||
        a?.balance?.currency ||
        ""
      ).toString();

      const val =
        a?.available_balance?.value ??
        a?.balance?.value ??
        a?.available_balance ??
        a?.balance ??
        "0";

      const n = Number(val);
      if (!Number.isFinite(n)) continue;

      if (currency === "USD") usdAvailable += n;
      if (currency === "BTC") btcBalance += n;
    }

    // 2) BTC price
    const productPath = "/api/v3/brokerage/products/BTC-USD";
    const jwt2 = buildCoinbaseJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: productPath,
    });

    const prod = await coinbaseFetch(jwt2, productPath);
    const priceRaw =
      prod.json?.price ??
      prod.json?.product?.price ??
      prod.json?.data?.price ??
      "0";

    const btcPrice = Number(priceRaw) || 0;
    const equityUsd = usdAvailable + btcBalance * btcPrice;

    // Snapshot write (best-effort)
    const nowIso = new Date().toISOString();
    const { error: snapErr } = await admin
      .from("user_account_snapshot")
      .upsert(
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
        { onConflict: "user_id" }
      );

    if (snapErr) {
      return NextResponse.json(
        { ok: false, error: "snapshot_write_failed", details: snapErr.message },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      exchange: "coinbase",
      equity_usd: equityUsd,
      available_usd: usdAvailable,
      btc_balance: btcBalance,
      btc_price_usd: btcPrice,
      last_checked_at: nowIso,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
