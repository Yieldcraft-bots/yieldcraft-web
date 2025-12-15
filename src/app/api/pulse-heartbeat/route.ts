// src/app/api/pulse-heartbeat/route.ts
// 🔒 LOCKED: Minimal, path-correct Coinbase heartbeat (NO EXTRA LOGIC)

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================
   ENV
========================= */
const API_KEY_NAME = process.env.COINBASE_API_KEY_NAME!;
const PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY!;

/* =========================
   JWT (PER-REQUEST, PATH-LOCKED)
========================= */
function buildJwt(method: string, path: string) {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iss: "cdp",
      sub: API_KEY_NAME,
      nbf: now,
      exp: now + 120,
      uri: `${method} ${path}`,
    },
    PRIVATE_KEY.replace(/\\n/g, "\n"),
    {
      algorithm: "ES256",
      header: {
        kid: API_KEY_NAME,
        nonce: crypto.randomBytes(16).toString("hex"),
      },
    }
  );
}

/* =========================
   COINBASE CALL
========================= */
async function callCoinbase(method: "GET", path: string) {
  const token = buildJwt(method, path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    raw: text,
  };
}

/* =========================
   HEARTBEAT
========================= */
export async function POST() {
  try {
    const path = "/api/v3/brokerage/products/BTC-USD/ticker";
    const res = await callCoinbase("GET", path);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      preview: res.raw.slice(0, 300),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// Allow Vercel Cron
export async function GET() {
  return POST();
}
