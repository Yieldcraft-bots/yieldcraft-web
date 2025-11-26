// src/app/api/coinbase/route.ts

import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { createPrivateKey } from "crypto";

export const runtime = "nodejs";

/**
 * Turn "\n" sequences from the env var into real newlines.
 */
function normalizePem(pem: string | undefined): string {
  if (!pem) {
    throw new Error("COINBASE_PRIVATE_KEY is missing");
  }
  return pem.replace(/\\n/g, "\n").trim();
}

/**
 * Build a Coinbase Advanced Trade JWT for a given HTTP method + path.
 */
async function buildJwt(method: string, path: string): Promise<string> {
  const keyName = process.env.COINBASE_API_KEY_NAME;
  const rawPrivate = process.env.COINBASE_PRIVATE_KEY;
  const alg = (process.env.COINBASE_KEY_ALG as "ES256") || "ES256";

  if (!keyName) throw new Error("COINBASE_API_KEY_NAME is missing");
  if (!rawPrivate) throw new Error("COINBASE_PRIVATE_KEY is missing");

  const normalizedPem = normalizePem(rawPrivate);

  // Convert EC (SEC1) private key to PKCS#8 so jose.importPKCS8 can use it
  const pkcs8Pem = createPrivateKey({
    key: normalizedPem,
    format: "pem",
  })
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  const privateKey = await importPKCS8(pkcs8Pem, alg);

  const now = Math.floor(Date.now() / 1000);
  const uri = `${method} api.coinbase.com${path}`;

  const jwt = await new SignJWT({
    sub: keyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri,
  })
    .setProtectedHeader({
      alg,
      kid: keyName,
      nonce: Math.random().toString(36).slice(2),
    })
    .sign(privateKey);

  return jwt;
}

/**
 * Call Coinbase Advanced Trade with a signed JWT.
 */
async function callCoinbase(method: "GET" | "POST", path: string) {
  const jwt = await buildJwt(method, path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse error, keep rawPreview
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    rawPreview: text.slice(0, 300),
  };
}

/**
 * GET /api/coinbase -> simple health check
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/coinbase
 * Calls Coinbase /api/v3/brokerage/accounts with a real JWT.
 */
export async function POST() {
  try {
    const result = await callCoinbase("GET", "/api/v3/brokerage/accounts");

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      preview: result.rawPreview,
      accounts: Array.isArray(result.json?.accounts)
        ? result.json.accounts.length
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
