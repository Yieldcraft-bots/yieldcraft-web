import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Coinbase AUTH PROBE — DO NOT MODIFY
 * Purpose: Prove ES256 JWT auth works.
 * This must stay stable once green.
 */

const API_BASE = "https://api.coinbase.com";
const API_KEY_NAME = process.env.COINBASE_API_KEY_NAME!;
const PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY!;

function buildJWT(method: string, path: string) {
  const uri = `${method} ${path}`;
  const nonce = crypto.randomBytes(16).toString("hex");

  return jwt.sign(
    {
      iss: "cdp",
      sub: API_KEY_NAME,
      uri,
    },
    PRIVATE_KEY,
    {
      algorithm: "ES256",
      header: {
        kid: API_KEY_NAME,
        nonce,
      },
      expiresIn: 120,
    }
  );
}

async function callCoinbase(method: string, path: string) {
  const token = buildJWT(method, path);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    raw: json,
  };
}

/**
 * AUTH CHECK — SAFE ENDPOINT
 */
export async function POST() {
  try {
    const path = "/api/v3/brokerage/accounts";
    const res = await callCoinbase("GET", path);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      auth: res.ok ? "AUTH_OK" : "AUTH_FAILED",
      response: res.raw,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

/**
 * Allow GET (Vercel Cron)
 */
export async function GET() {
  return POST();
}
