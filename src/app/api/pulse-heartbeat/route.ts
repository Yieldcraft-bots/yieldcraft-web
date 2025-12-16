// src/app/api/pulse-heartbeat/route.ts
// HEARTBEAT (SAFE): Auth + connectivity + status payload
// NO trading. Cron-safe. Proof-of-life endpoint.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function normalizePrivateKey(raw: string): string {
  const s = raw.trim();
  // If Vercel stored it with literal "\n", convert to real newlines
  return s.includes("\\n") ? s.replace(/\\n/g, "\n") : s;
}

// IMPORTANT: host-style uri (no scheme)
function formatJwtUri(method: string, path: string) {
  return `${method.toUpperCase()} api.coinbase.com${path}`;
}

function buildJwt(method: "GET" | "POST", path: string) {
  const API_KEY_NAME = mustEnv("COINBASE_API_KEY_NAME");
  const PRIVATE_KEY = normalizePrivateKey(mustEnv("COINBASE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);

  const payload: any = {
    iss: "cdp",
    sub: API_KEY_NAME,
    nbf: now,
    exp: now + 120,
    uri: formatJwtUri(method, path),
  };

  // Coinbase requires nonce, TS types don’t know it -> cast to any
  const header: any = {
    kid: API_KEY_NAME,
    alg: "ES256",
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const options: any = {
    algorithm: "ES256",
    header,
  };

  return jwt.sign(payload, PRIVATE_KEY as any, options);
}

async function callCoinbase(method: "GET" | "POST", path: string) {
  const token = buildJwt(method, path);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, raw: text.slice(0, 400) };
}

async function heartbeat() {
  const product = process.env.PULSE_PRODUCT || "BTC-USD";
  const executionEnabled = truthy(process.env.EXECUTION_ENABLED);

  try {
    const path = "/api/v3/brokerage/accounts";
    const r = await callCoinbase("GET", path);

    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      mode: "HEARTBEAT_ONLY",
      auth: r.ok ? "AUTH_OK" : "AUTH_FAILED",
      product,
      trading_enabled: executionEnabled,
      timestamp: new Date().toISOString(),
      note: "Non-trading heartbeat. Proof-of-life + auth check only.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        mode: "HEARTBEAT_ONLY",
        error: err?.message ?? String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Cron uses GET, but POST works too
export async function GET() {
  return heartbeat();
}
export async function POST() {
  return heartbeat();
}
