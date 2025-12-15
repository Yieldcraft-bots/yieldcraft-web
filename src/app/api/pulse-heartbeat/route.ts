// src/app/api/pulse-heartbeat/route.ts
// Pulse bot heartbeat – Coinbase CDP JWT auth (PKCS8 enforced)

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

/* =========================================================
   Coinbase JWT Config (CDP compliant)
   ========================================================= */

const API_KEY_NAME =
  process.env.COINBASE_API_KEY_NAME ??
  "organizations/76dbf189-7838-4cd3-919e-6b9e0df3bec1/apiKeys/d9cd5723-5473-4dbb-94e1-527f922ce999";

// Cache the private key so it is read once per lambda
let cachedPrivateKey: string | null = null;

function getPrivateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;

  // 🔐 FORCE PKCS8 – Coinbase REQUIRES THIS
  const pkcs8Path = path.join(process.cwd(), "src", "coinbase-pkcs8.pem");
  cachedPrivateKey = fs.readFileSync(pkcs8Path, "utf8").trim();

  return cachedPrivateKey;
}

function formatJwtUri(method: string, pathStr: string): string {
  // Coinbase expects: "GET /api/v3/brokerage/products/BTC-USD/ticker"
  return `${method.toUpperCase()} ${pathStr}`;
}

function buildJwt(method: "GET" | "POST", pathStr: string): string {
  const now = Math.floor(Date.now() / 1000);
  const uri = formatJwtUri(method, pathStr);

  const payload = {
    iss: "cdp",
    sub: API_KEY_NAME,
    nbf: now,
    exp: now + 120,
    uri,
  };

  const header = {
    alg: "ES256",
    kid: API_KEY_NAME,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  return jwt.sign(payload as any, getPrivateKey(), {
    algorithm: "ES256",
    header,
  } as any);
}

/* =========================================================
   Coinbase HTTP Helper
   ========================================================= */

async function callCoinbase(
  method: "GET" | "POST",
  pathStr: string,
  body?: any
) {
  const token = buildJwt(method, pathStr);

  const res = await fetch(`https://api.coinbase.com${pathStr}`, {
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
  } catch {}

  return {
    ok: res.ok,
    status: res.status,
    json,
    raw: text.slice(0, 500),
  };
}

/* =========================================================
   Pulse Heartbeat
   ========================================================= */

export async function POST() {
  try {
    if (process.env.BOT_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "BOT_DISABLED" },
        { status: 403 }
      );
    }

    if (process.env.COINBASE_TRADING_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "COINBASE_TRADING_DISABLED" },
        { status: 403 }
      );
    }

    const productId = process.env.PULSE_PRODUCT ?? "BTC-USD";
    const baseSize = process.env.PULSE_BASE_SIZE ?? "0.000020";
    const makerOffsetBps = Number(process.env.MAKER_OFFSET_BPS ?? "1.0");

    /* ---------- 1) Ticker ---------- */
    const tickerPath = `/api/v3/brokerage/products/${productId}/ticker`;
    const ticker = await callCoinbase("GET", tickerPath);

    if (!ticker.ok || !ticker.json) {
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

    const bestBid = Number(ticker.json.best_bid);
    const bestAsk = Number(ticker.json.best_ask);

    if (!bestBid || !bestAsk) {
      return NextResponse.json(
        { ok: false, reason: "bad_ticker_prices", ticker: ticker.json },
        { status: 502 }
      );
    }

    /* ---------- 2) Simple BUY for now ---------- */
    const offset = makerOffsetBps / 10_000;
    const limitPrice = bestBid * (1 - offset);

    const orderPath = "/api/v3/brokerage/orders";

    const order = {
      client_order_id: `pulse-${Date.now()}`,
      product_id: productId,
      side: "BUY",
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
      product_id: productId,
      base_size: baseSize,
      limit_price: limitPrice.toFixed(2),
      order_preview: orderRes.raw,
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
