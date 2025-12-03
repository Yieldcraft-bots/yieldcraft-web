// src/app/api/pulse-heartbeat/route.ts
// Pulse bot heartbeat with Recon integration + maker-first order + smart fallback.

import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import fs from "fs";
import path from "path";

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
  if (!brain?.ok) {
    return { allow: true, reason: "brain_unreachable_or_not_ok" };
  }

  const bot = brain.bots?.find((b) => b.name === "pulse");

  if (!bot) {
    return { allow: false, reason: "pulse_not_present_in_brain" };
  }

  if (bot.enabled === false) {
    return { allow: false, reason: "pulse_disabled_by_brain" };
  }

  return { allow: true, reason: "brain_allows_trade" };
}

export const runtime = "nodejs";

// --- Private key loading (from file, not env) ---

let cachedPkcs8: string | null = null;

function getPkcs8Pem(): string {
  if (cachedPkcs8) return cachedPkcs8;

  // coinbase-pkcs8.pem lives in src/
  const pemPath = path.join(process.cwd(), "src", "coinbase-pkcs8.pem");
  const pem = fs.readFileSync(pemPath, "utf8").trim();
  cachedPkcs8 = pem;
  return pem;
}

/**
 * Build a Coinbase Advanced Trade JWT for a given HTTP method + path.
 * Coinbase expects:
 *   iss = "cdp"
 *   sub = organizations/{org_id}/apiKeys/{key_id}
 *   uri = "<METHOD> <PATH>"  e.g. "GET /api/v3/brokerage/products/BTC-USD/ticker"
 */
async function buildJwt(method: string, pathStr: string): Promise<string> {
  const keyName = process.env.COINBASE_API_KEY_NAME;
  const alg = (process.env.COINBASE_KEY_ALG as "ES256") || "ES256";

  if (!keyName) throw new Error("COINBASE_API_KEY_NAME is missing");

  const pkcs8Pem = getPkcs8Pem();
  const privateKey = await importPKCS8(pkcs8Pem, alg);

  const now = Math.floor(Date.now() / 1000);
  const uri = `${method.toUpperCase()} ${pathStr}`;

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
 * Generic Coinbase call helper.
 */
async function callCoinbase(
  method: "GET" | "POST",
  pathStr: string,
  body?: any
) {
  const jwt = await buildJwt(method, pathStr);

  const res = await fetch(`https://api.coinbase.com${pathStr}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
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
  const brain = await fetchBrainConfig();
  const gating = shouldAllowPulseTrade(brain);

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
      limitPrice = bestBid * (1 - offset);
    } else {
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
            post_only: false,
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
