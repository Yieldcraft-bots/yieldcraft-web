// src/app/api/pulse-heartbeat/route.ts
// Pulse bot heartbeat with Recon integration + maker-first order + smart fallback.

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// --- YieldCraft Brain integration (small-account risk layer) ---

type BrainBotConfig = {
  name: string;
  enabled?: boolean;
};

type BrainSnapshot = {
  ok?: boolean;
  risk_tier?: string;
  max_simultaneous_bots?: number;
  bots?: BrainBotConfig[];
};

async function fetchBrainConfig(): Promise<BrainSnapshot | null> {
  try {
    const res = await fetch("http://localhost:3000/api/brain", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("brain_fetch_not_ok", res.status);
      return null;
    }

    const json = (await res.json()) as BrainSnapshot;
    return json;
  } catch (err) {
    console.error("brain_fetch_failed", err);
    return null;
  }
}

function shouldAllowPulseTrade(brain: BrainSnapshot | null) {
  // If brain is down or not OK, fail open for now (let Pulse run)
  if (!brain?.ok) {
    return { allow: true, reason: "brain_unreachable_or_not_ok" };
  }

  const bot = brain.bots?.find((b) => b.name === "pulse");

  // If Pulse is not listed in the brain, be conservative and block
  if (!bot) {
    return { allow: false, reason: "pulse_not_present_in_brain" };
  }

  // Explicit kill-switch from the brain
  if (bot.enabled === false) {
    return { allow: false, reason: "pulse_disabled_by_brain" };
  }

  // Later we can add concurrency / risk-tier checks here
  return { allow: true, reason: "brain_allows_trade" };
}

// Force Node.js serverless runtime so Vercel Cron Jobs can call this
export const runtime = "nodejs";

// --- Coinbase JWT pieces (match coinbase-jwt-test.js) ---

const apiKeyName =
  process.env.COINBASE_API_KEY_NAME ||
  "organizations/76dbf189-7838-4cd3-919e-6b9e0df3bec1/apiKeys/d9cd5723-5473-4dbb-94e1-527f922ce999";

let cachedPrivateKey: string | null = null;

function getPrivateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;

  let rawKey = process.env.COINBASE_PRIVATE_KEY;
  if (!rawKey) {
    const pkcs8Path = path.join(process.cwd(), "src", "coinbase-pkcs8.pem");
    rawKey = fs.readFileSync(pkcs8Path, "utf8");
  }

  // Normalize \n sequences from env into real newlines
  cachedPrivateKey = rawKey.replace(/\\n/g, "\n");
  return cachedPrivateKey;
}

// Coinbase expects URI like "GET /api/v3/brokerage/accounts" (no hostname)
function formatJwtUri(method: string, pathStr: string): string {
  return `${method.toUpperCase()} ${pathStr}`;
}

function buildJwt(method: string, pathStr: string): string {
  if (!apiKeyName) {
    throw new Error("COINBASE_API_KEY_NAME is missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const uri = formatJwtUri(method, pathStr);
  const privateKey = getPrivateKey();

  const payload = {
    sub: apiKeyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri,
  };

  // Include nonce in header (required by Coinbase),
  // but cast as any so TypeScript/Vercel stop complaining.
  const header: any = {
    kid: apiKeyName,
    alg: "ES256",
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const token = jwt.sign(payload as any, privateKey as any, {
    algorithm: "ES256",
    header,
  } as any);

  return token;
}

/**
 * Generic Coinbase call helper.
 */
async function callCoinbase(
  method: "GET" | "POST",
  pathStr: string,
  body?: any
) {
  const jwtToken = buildJwt(method, pathStr);

  const res = await fetch(`https://api.coinbase.com${pathStr}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwtToken}`,
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
    // ignore parse error
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    rawPreview: text.slice(0, 400),
  };
}

/**
 * Recon signal structure.
 */
type ReconSide = "BUY" | "SELL" | "HOLD";

interface ReconSignal {
  side: ReconSide;
  confidence: number;
  regime?: string;
  source: string;
  raw?: any;
}

/**
 * Get Recon signal from URL.
 */
async function getReconSignal(): Promise<ReconSignal> {
  const url = process.env.RECON_SIGNAL_URL;
  const minConf = Number(process.env.RECON_MIN_CONF ?? "0.6");

  if (!url) {
    return {
      side: "HOLD",
      confidence: 0,
      regime: "none",
      source: "missing_url",
    };
  }

  try {
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();

    const sideRaw = String(json.side ?? "").toUpperCase();
    const side: ReconSide =
      sideRaw === "BUY" || sideRaw === "SELL" ? (sideRaw as ReconSide) : "HOLD";

    const confidence = Number(json.confidence ?? 0);

    if (confidence < minConf || side === "HOLD") {
      return {
        side: "HOLD",
        confidence,
        regime: json.regime ?? "unknown",
        source: "low_conf_or_hold",
        raw: json,
      };
    }

    return {
      side,
      confidence,
      regime: json.regime ?? "unknown",
      source: "url",
      raw: json,
    };
  } catch (err) {
    return {
      side: "HOLD",
      confidence: 0,
      regime: "error",
      source: "url_error",
      raw: String(err),
    };
  }
}

/**
 * POST /api/pulse-heartbeat
 * Pulse bot with Recon gate + maker-first order + smart fallback.
 */
export async function POST() {
  // --- Small-account Brain gating (global risk filter) ---
  const brain = await fetchBrainConfig();
  const gating = shouldAllowPulseTrade(brain);

  // If the brain explicitly says "no Pulse", respect it.
  // If the brain is missing / not OK, we fail open for now.
  if (!gating.allow) {
    return NextResponse.json(
      { ok: false, reason: gating.reason, brain },
      { status: 200 }
    );
  }

  const bots = Array.isArray(brain?.bots) ? brain!.bots : [];
  const MAX_SIM = brain?.max_simultaneous_bots;

  const ascendBot = bots.find((b) => b.name === "ascend");
  const ignitionBot = bots.find((b) => b.name === "ignition");

  const ASCEND_ENABLED = ascendBot?.enabled === true;
  const IGNITION_ENABLED = ignitionBot?.enabled === true;

  if (!ASCEND_ENABLED || !IGNITION_ENABLED) {
    console.log(
      "Brain gating: Ascend or Ignition disabled — Pulse stays primary.",
      { ASCEND_ENABLED, IGNITION_ENABLED, MAX_SIM }
    );
  }

  try {
    if (process.env.BOT_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "BOT_ENABLED is not true" },
        { status: 403 }
      );
    }

    if (process.env.COINBASE_TRADING_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "COINBASE_TRADING_ENABLED is not true" },
        { status: 403 }
      );
    }

    const productId = process.env.PULSE_PRODUCT || "BTC-USD";
    const baseSize = process.env.PULSE_BASE_SIZE || "0.000020";
    const makerOffsetBps = Number(process.env.MAKER_OFFSET_BPS ?? "1.0");

    // 1) Get Recon signal
    const recon = await getReconSignal();

    if (recon.side === "HOLD") {
      return NextResponse.json({
        ok: true,
        took_trade: false,
        reason: "Recon HOLD / low confidence / no URL",
        recon,
      });
    }

    // 2) Get ticker for maker price
    const tickerPath = `/api/v3/brokerage/products/${productId}/ticker`;
    const ticker = await callCoinbase("GET", tickerPath);

    if (!ticker.ok || !ticker.json) {
      return NextResponse.json(
        {
          ok: false,
          reason: "ticker_failed",
          ticker_status: ticker.status,
          ticker_preview: ticker.rawPreview,
          recon,
        },
        { status: 502 }
      );
    }

    const bestBid = Number(ticker.json.best_bid ?? ticker.json.price);
    const bestAsk = Number(ticker.json.best_ask ?? ticker.json.price);

    if (!bestBid || !bestAsk) {
      return NextResponse.json(
        {
          ok: false,
          reason: "bad_ticker_prices",
          ticker: ticker.json,
          recon,
        },
        { status: 502 }
      );
    }

    const offset = makerOffsetBps / 10_000; // bps to fraction
    let limitPrice: number;

    if (recon.side === "BUY") {
      // Slightly below best bid to stay maker
      limitPrice = bestBid * (1 - offset);
    } else {
      // SELL: slightly above best ask
      limitPrice = bestAsk * (1 + offset);
    }

    const limitPriceStr = limitPrice.toFixed(2); // 2 decimal places for USD

    const allowIocFallback =
      String(process.env.MAKER_ALLOW_IOC_FALLBACK).toLowerCase() === "true";

    // 3) Send maker-first limit order (post_only: true)
    const orderPath = "/api/v3/brokerage/orders";

    const orderBody = {
      client_order_id: `pulse-${Date.now()}`,
      product_id: productId,
      side: recon.side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: baseSize,
          limit_price: limitPriceStr,
          post_only: true,
        },
      },
    };

    let orderRes = await callCoinbase("POST", orderPath, orderBody);
    let usedFallback = false;
    let primaryError: string | undefined;

    // If Coinbase rejects because of post-only price, optionally re-send without post_only.
    const errResp = orderRes.json?.error_response || {};
    const errCodeRaw =
      errResp.error ||
      errResp.error_code ||
      errResp.preview_failure_reason ||
      errResp.error_details?.preview_failure_reason;

    const errCode =
      typeof errCodeRaw === "string" ? errCodeRaw.toUpperCase() : "";

    if (
      !orderRes.ok &&
      allowIocFallback &&
      errCode.includes("INVALID_LIMIT_PRICE_POST_ONLY")
    ) {
      primaryError = errCode;

      const fallbackBody = {
        client_order_id: `pulse-fb-${Date.now()}`,
        product_id: productId,
        side: recon.side,
        order_configuration: {
          limit_limit_gtc: {
            base_size: baseSize,
            limit_price: limitPriceStr,
            post_only: false, // allow taker if needed
          },
        },
      };

      orderRes = await callCoinbase("POST", orderPath, fallbackBody);
      usedFallback = true;
    }

    return NextResponse.json({
      ok: orderRes.ok,
      status: orderRes.status,
      recon,
      product_id: productId,
      base_size: baseSize,
      maker_offset_bps: makerOffsetBps,
      limit_price: limitPriceStr,
      used_fallback: usedFallback,
      primary_error: primaryError,
      order_preview: orderRes.rawPreview,
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

// Allow Vercel Cron (GET) to reuse the exact same trading logic as POST
export async function GET() {
  return POST();
}
