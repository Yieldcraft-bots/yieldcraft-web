// src/app/api/pulse-heartbeat/route.ts
// Coinbase Pulse Heartbeat — AUTH-FIRST, ENV-ONLY, ES256 (ECDSA P-256)

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================================================
   REQUIRED ENV VARS (NO FILES, NO FALLBACKS)
   ========================================================= */

const API_KEY_NAME = process.env.COINBASE_API_KEY_NAME;
const RAW_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;

if (!API_KEY_NAME) {
  throw new Error("Missing COINBASE_API_KEY_NAME");
}
if (!RAW_PRIVATE_KEY) {
  throw new Error("Missing COINBASE_PRIVATE_KEY");
}

// Convert escaped \n → real newlines (Coinbase requirement)
const PRIVATE_KEY = RAW_PRIVATE_KEY.replace(/\\n/g, "\n");

/* =========================================================
   JWT HELPERS (MATCH COINBASE DOCS EXACTLY)
   ========================================================= */

function formatJwtUri(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

function buildJwt(method: string, path: string) {
  const now = Math.floor(Date.now() / 1000);
  const uri = formatJwtUri(method, path);

  const payload = {
    iss: "cdp",
    sub: API_KEY_NAME,
    nbf: now,
    exp: now + 120,
    uri,
  };

  const header: any = {
    alg: "ES256",
    kid: API_KEY_NAME,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: "ES256",
    header,
  });
}

/* =========================================================
   COINBASE REQUEST WRAPPER
   ========================================================= */

async function callCoinbase(
  method: "GET" | "POST",
  path: string,
  body?: any
) {
  const token = buildJwt(method, path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    raw: text.slice(0, 500),
  };
}

/* =========================================================
   HEARTBEAT (AUTH + TICKER TEST)
   ========================================================= */

export async function POST() {
  try {
    if (process.env.BOT_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "BOT_DISABLED" },
        { status: 403 }
      );
    }

    // 🔑 AUTH TEST — THIS MUST PASS FIRST
    const product = process.env.PULSE_PRODUCT || "BTC-USD";
    const tickerPath = `/api/v3/brokerage/products/${product}/ticker`;

    const ticker = await callCoinbase("GET", tickerPath);

    if (!ticker.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "ticker_failed",
          status: ticker.status,
          preview: ticker.raw,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      auth: "AUTH_OK",
      product,
      ticker: ticker.json,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   ALLOW GET (VERCEL CRON)
   ========================================================= */

export async function GET() {
  return POST();
}
