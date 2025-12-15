// src/app/api/pulse-heartbeat/route.ts
// Minimal Coinbase AUTH PROBE (ES256) — stable + TypeScript-safe for Vercel build.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Normalize private key from Vercel:
// - If pasted as multi-line, keep it
// - If pasted with \n escapes, convert to real newlines
function normalizePrivateKey(raw: string): string {
  const s = raw.trim();
  if (s.includes("\\n")) return s.replace(/\\n/g, "\n");
  return s;
}

// Coinbase App requires uri like: "GET /api/v3/brokerage/accounts"
function formatJwtUri(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

function buildJwt(method: "GET" | "POST", path: string) {
  const API_KEY_NAME = mustEnv("COINBASE_API_KEY_NAME"); // organizations/.../apiKeys/...
  const PRIVATE_KEY = normalizePrivateKey(mustEnv("COINBASE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    iss: "cdp",
    sub: API_KEY_NAME,
    nbf: now,
    exp: now + 120,
    uri: formatJwtUri(method, path),
  };

  // IMPORTANT: nonce is required by Coinbase, but jsonwebtoken TS types don't know it.
  const header: any = {
    kid: API_KEY_NAME,
    alg: "ES256",
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  // Cast options to any to avoid TS overload issues in Vercel build
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
  return { ok: res.ok, status: res.status, raw: text.slice(0, 600) };
}

// AUTH CHECK — SAFE ENDPOINT (no trading)
export async function POST() {
  try {
    const path = "/api/v3/brokerage/accounts";
    const r = await callCoinbase("GET", path);

    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      auth: r.ok ? "AUTH_OK" : "AUTH_FAILED",
      preview: r.raw,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

// Allow GET (Vercel Cron)
export async function GET() {
  return POST();
}
