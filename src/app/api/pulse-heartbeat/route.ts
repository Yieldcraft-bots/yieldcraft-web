// src/app/api/pulse-heartbeat/route.ts
// Pulse bot heartbeat — Coinbase CDP compliant, maker-first, Recon-gated

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================================================
   ENV — SINGLE SOURCE OF TRUTH
   ========================================================= */

const API_KEY_NAME = process.env.COINBASE_API_KEY_NAME!;
const PRIVATE_KEY_RAW = process.env.COINBASE_PRIVATE_KEY!;
const KEY_ALG = "ES256";

if (!API_KEY_NAME || !PRIVATE_KEY_RAW) {
  throw new Error("Missing Coinbase API env vars");
}

// Normalize \n → real newlines (Vercel-safe)
const PRIVATE_KEY = PRIVATE_KEY_RAW.replace(/\\n/g, "\n");

/* =========================================================
   JWT BUILDER — COINBASE CDP SPEC (CORRECT)
   ========================================================= */

function buildJwt(method: string, path: string) {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: "cdp",
    sub: API_KEY_NAME,
    nbf: now,
    exp: now + 120,
    uri: `${method.toUpperCase()} https://api.coinbase.com${path}`,
  };

  const header = {
    alg: KEY_ALG,
    kid: API_KEY_NAME,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: KEY_ALG,
    header,
  });
}

/* =========================================================
   COINBASE CALL HELPER
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

  return {
    ok: res.ok,
    status: res.status,
    raw: text.slice(0, 500),
    json: (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  };
}

/* =========================================================
   RECON SIGNAL
   ========================================================= */

async function getRecon() {
  const url = process.env.RECON_SIGNAL_URL;
  const minConf = Number(process.env.RECON_MIN_CONF ?? "0.6");

  if (!url) {
    return { side: "HOLD", confidence: 0, source: "missing_url" };
  }

  try {
    const res = await fetch(url);
    const json = await res.json();

    const side = String(json.side ?? "HOLD").toUpperCase();
    const confidence = Number(json.confidence ?? 0);

    if (confidence < minConf || !["BUY", "SELL"].includes(side)) {
      return { side: "HOLD", confidence, source: "low_conf" };
    }

    return {
      side,
      confidence,
      regime: json.regime,
      source: "url",
      raw: json,
    };
  } catch {
    return { side: "HOLD", confidence: 0, source: "error" };
  }
}

/* =========================================================
   MAIN HANDLER
   ========================================================= */

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    if (process.env.BOT_ENABLED !== "true") {
      return NextResponse.json({ ok: false, reason: "BOT_DISABLED" });
    }

    if (process.env.COINBASE_TRADING_ENABLED !== "true") {
      return NextResponse.json({ ok: false, reason: "TRADING_DISABLED" });
    }

    const product = process.env.PULSE_PRODUCT ?? "BTC-USD";
    const baseSize = process.env.PULSE_BASE_SIZE ?? "0.000020";
    const offsetBps = Number(process.env.MAKER_OFFSET_BPS ?? "1.0");

    /* ---------- Recon ---------- */
    const recon = await getRecon();
    if (recon.side === "HOLD") {
      return NextResponse.json({ ok: true, took_trade: false, recon });
    }

    /* ---------- Ticker ---------- */
    const tickerPath = `/api/v3/brokerage/products/${product}/ticker`;
    const ticker = await callCoinbase("GET", tickerPath);

    if (!ticker.ok || !ticker.json) {
      return NextResponse.json({
        ok: false,
        reason: "ticker_failed",
        status: ticker.status,
        preview: ticker.raw,
        recon,
      });
    }

    const bid = Number(ticker.json.best_bid);
    const ask = Number(ticker.json.best_ask);
    if (!bid || !ask) {
      return NextResponse.json({ ok: false, reason: "bad_ticker", ticker });
    }

    const offset = offsetBps / 10_000;
    const limitPrice =
      recon.side === "BUY" ? bid * (1 - offset) : ask * (1 + offset);

    /* ---------- Order ---------- */
    const orderPath = "/api/v3/brokerage/orders";

    const order = {
      client_order_id: `pulse-${Date.now()}`,
      product_id: product,
      side: recon.side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: baseSize,
          limit_price: limitPrice.toFixed(2),
          post_only: true,
        },
      },
    };

    const orderRes = await callCoinbase("POST", orderPath, order);

    return NextResponse.json({
      ok: orderRes.ok,
      status: orderRes.status,
      recon,
      order_preview: orderRes.raw,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
