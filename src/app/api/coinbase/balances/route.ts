import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------- helpers ------------------------- */

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

/**
 * Build Coinbase Advanced Trade JWT (ES256)
 * IMPORTANT:
 * - alg = ES256
 * - sign with SHA256 (ECDSA)
 * - dsaEncoding = ieee-p1363 (Coinbase requirement)
 */
function buildCoinbaseJwt(opts: {
  apiKeyName: string;
  privateKeyPem: string;
  method: string;
  path: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60;

  const header = {
    alg: "ES256",
    kid: opts.apiKeyName,
    nonce: crypto.randomBytes(16).toString("hex"),
    typ: "JWT",
  };

  const payload = {
    iss: "cdp",
    nbf: now,
    exp,
    uri: `${opts.method.toUpperCase()} api.coinbase.com${opts.path}`,
  };

  const b64url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const input = `${b64url(header)}.${b64url(payload)}`;

  // ✅ CORRECT SIGNER FOR ES256
  const sign = crypto.createSign("SHA256");
  sign.update(input);
  sign.end();

  const signature = sign
    .sign({ key: opts.privateKeyPem, dsaEncoding: "ieee-p1363" })
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
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { ok: res.ok, status: res.status, json, text };
}

/* ------------------------- route ------------------------- */

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return NextResponse.json(
        { ok: false, error: "server_misconfigured" },
        { status: 500 }
      );
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve user
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userErr || !userId) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Load Coinbase keys
    const { data: keys } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!keys?.api_key_name || !keys?.private_key) {
      return NextResponse.json({ ok: false, error: "no_keys" }, { status: 200 });
    }

    const apiKeyName = String(keys.api_key_name).trim();
    const privateKeyPem = normalizePem(keys.private_key);

    // Fetch accounts
    const accountsPath = "/api/v3/brokerage/accounts";
    const jwt = buildCoinbaseJwt({
      apiKeyName,
      privateKeyPem,
      method: "GET",
      path: accountsPath,
    });

    const acct = await coinbaseFetch(jwt, accountsPath);

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

    // Parse balances
    const arr =
      acct.json?.accounts ||
      acct.json?.data ||
      acct.json ||
      [];

    let usdAvailable = 0;
    let btcBalance = 0;

    for (const a of arr) {
      const cur =
        a?.currency ||
        a?.available_balance?.currency ||
        a?.balance?.currency ||
        "";
      const val =
        a?.available_balance?.value ??
        a?.balance?.value ??
        a?.available ??
        "0";

      const n = Number(val);
      if (cur === "USD" && isFinite(n)) usdAvailable += n;
      if (cur === "BTC" && isFinite(n)) btcBalance += n;
    }

    return NextResponse.json({
      ok: true,
      exchange: "coinbase",
      available_usd: usdAvailable,
      btc_balance: btcBalance,
      last_checked_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
