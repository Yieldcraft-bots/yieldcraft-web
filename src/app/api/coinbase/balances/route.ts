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

/**
 * Coinbase Advanced Trade — Ed25519 (EdDSA) JWT signer
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
    alg: "EdDSA",
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

  const base64url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const input = `${base64url(header)}.${base64url(payload)}`;

  const signature = crypto
    .sign(null, Buffer.from(input), {
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363",
    })
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

export async function GET(req: Request) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: keys } = await admin
      .from("coinbase_keys")
      .select("api_key_name, private_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!keys?.api_key_name || !keys?.private_key) {
      return NextResponse.json({ ok: false, error: "no_keys" }, { status: 200 });
    }

    const jwt = buildCoinbaseJwt({
      apiKeyName: keys.api_key_name.trim(),
      privateKeyPem: normalizePem(keys.private_key),
      method: "GET",
      path: "/api/v3/brokerage/accounts",
    });

    const acct = await coinbaseFetch(jwt, "/api/v3/brokerage/accounts");
    if (!acct.ok) {
      return NextResponse.json(
        { ok: false, error: "coinbase_accounts_failed", status: acct.status, details: acct.json ?? acct.text },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, accounts: acct.json });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
