// src/app/api/pulse-heartbeat/route.ts
// HEARTBEAT (SAFE): Coinbase auth probe + local system health
// + calls /api/pulse-trade in DRY RUN (NO live orders placed here).

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================
   Helpers
   ========================= */

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

// Build an origin that works on localhost + Vercel
function getOrigin(req: Request) {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.headers.get("host")?.includes("localhost") ? "http" : "https");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function callPulseTradeDryRun(req: Request, product_id: string) {
  const origin = getOrigin(req);

  // DRY RUN ONLY (safe). This does not place an order.
  const body = {
    action: "dry_run_order",
    product_id,
    side: "BUY",
    quote_size: "1.00",
  };

  const r = await fetch(`${origin}/api/pulse-trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await r.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }

  return {
    ok: r.ok,
    status: r.status,
    data: parsed,
  };
}

/* =========================
   Heartbeat
   ========================= */

async function heartbeat(req: Request) {
  const product = process.env.PULSE_PRODUCT || "BTC-USD";

  // NOTE: These are the same gates your /api/pulse-trade uses.
  const gates = {
    BOT_ENABLED: truthy(process.env.BOT_ENABLED),
    COINBASE_TRADING_ENABLED: truthy(process.env.COINBASE_TRADING_ENABLED),
    PULSE_TRADE_ARMED: truthy(process.env.PULSE_TRADE_ARMED),
    LIVE_ALLOWED: truthy(process.env.EXECUTION_ENABLED), // your code currently maps this to LIVE_ALLOWED
  };

  try {
    // 1) Coinbase auth probe (real call, but no trading)
    const authProbe = await callCoinbase("GET", "/api/v3/brokerage/accounts");

    // 2) Pulse-trade DRY RUN (internal call; safe)
    let tradeDryRun: any = null;
    try {
      tradeDryRun = await callPulseTradeDryRun(req, product);
    } catch (e: any) {
      tradeDryRun = {
        ok: false,
        status: 0,
        data: { error: e?.message ?? String(e) },
      };
    }

    return NextResponse.json({
      ok: true,
      status: 200,
      mode: "HEARTBEAT_SAFE_WITH_DRYRUN",
      timestamp: new Date().toISOString(),

      product,

      // Coinbase connectivity/auth
      coinbase_auth: {
        ok: authProbe.ok,
        status: authProbe.status,
        auth: authProbe.ok ? "AUTH_OK" : "AUTH_FAILED",
        raw_preview: authProbe.raw,
      },

      // Your env gates (visibility)
      gates,

      // What pulse-trade WOULD do (DRY RUN only)
      pulse_trade_dryrun: tradeDryRun,
      note:
        "Safe heartbeat: checks Coinbase auth + calls /api/pulse-trade in DRY RUN only. No live trades are placed by this route.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        mode: "HEARTBEAT_SAFE_WITH_DRYRUN",
        error: err?.message ?? String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Cron uses GET, but POST works too
export async function GET(req: Request) {
  return heartbeat(req);
}
export async function POST(req: Request) {
  return heartbeat(req);
}
