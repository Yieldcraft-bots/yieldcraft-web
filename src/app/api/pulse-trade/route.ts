// src/app/api/pulse-trade/route.ts
// Pulse Trade: Coinbase Advanced Trade order router
// Actions: status | dry_run_order | place_order
// SAFETY GATES (BOTH must be true to place live orders):
//   1) COINBASE_TRADING_ENABLED=true
//   2) PULSE_TRADE_ARMED=true
//
// NOTE: This route NEVER runs automatically. It only runs when you call it.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Optional: log to Supabase if you have service-role wiring in env.
// If not present, logging is skipped (never blocks).
// Uses REST endpoint so we don't depend on your local supabase client code.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";
type Action = "status" | "dry_run_order" | "place_order";

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function jsonError(message: string, status = 400, extra: any = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function normalizePem(pem: string) {
  let p = pem.trim();

  // strip surrounding quotes if present
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }

  // convert literal \n into real newlines
  p = p.replace(/\\n/g, "\n");
  // normalize newlines
  p = p.replace(/\r\n/g, "\n");
  return p;
}

function buildCdpJwt(method: "GET" | "POST", path: string) {
  const apiKeyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKeyRaw = requireEnv("COINBASE_PRIVATE_KEY");
  const privateKey = normalizePem(privateKeyRaw);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  // IMPORTANT: host-style uri (no scheme)
  const uri = `${method} api.coinbase.com${path}`;

  const payload = {
    iss: "cdp",
    sub: apiKeyName,
    nbf: now,
    exp: now + 60,
    uri,
  };

  return jwt.sign(payload, privateKey as any, {
    algorithm: "ES256",
    header: { kid: apiKeyName, nonce } as any,
  });
}

async function logToSupabase(row: {
  bot: string;
  symbol?: string | null;
  side?: Side | null;
  base_size?: string | null;
  quote_size?: string | null;
  price?: string | null;
  maker_taker?: string | null;
  regime?: string | null;
  confidence?: number | null;
  order_id?: string | null;
  raw?: any;
}) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

    // Use PostgREST (service role required). Never blocks.
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/trade_logs`;

    const payload = {
      bot: row.bot,
      symbol: row.symbol ?? null,
      side: row.side ?? null, // make sure your DB allows NULL side for non-trade logs
      base_size: row.base_size ?? null,
      quote_size: row.quote_size ?? null,
      price: row.price ?? null,
      maker_taker: row.maker_taker ?? null,
      regime: row.regime ?? null,
      confidence: row.confidence ?? null,
      order_id: row.order_id ?? null,
      raw: row.raw ?? {},
    };

    await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow
  }
}

// GET helper so you can hit it in browser without 405
export async function GET() {
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);

  return NextResponse.json({
    ok: true,
    status: "PULSE_TRADE_READY",
    gates: {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
      LIVE_ALLOWED: tradingEnabled && armed,
    },
  });
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const action = (body?.action || "status") as Action;

  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);
  const liveAllowed = tradingEnabled && armed;

  if (action === "status") {
    return NextResponse.json({
      ok: true,
      status: "PULSE_TRADE_READY",
      gates: {
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
    });
  }

  // Inputs
  const product_id = String(body?.product_id || "BTC-USD");
  const side = String(body?.side || "BUY").toUpperCase() as Side;

  const quote_size = body?.quote_size != null ? String(body.quote_size) : null;
  const base_size = body?.base_size != null ? String(body.base_size) : null;

  if (side !== "BUY" && side !== "SELL") {
    return jsonError("side must be BUY or SELL.", 400, { side });
  }

  // Build Coinbase order payload
  const client_order_id = `yc_${action}_${Date.now()}`;

  let order_configuration: any = null;

  if (side === "BUY") {
    if (!quote_size) return jsonError('BUY requires quote_size (e.g. "1.00").', 400);
    order_configuration = { market_market_ioc: { quote_size } };
  } else {
    if (!base_size) return jsonError('SELL requires base_size (e.g. "0.00001").', 400);
    order_configuration = { market_market_ioc: { base_size } };
  }

  const orderPayload = {
    client_order_id,
    product_id,
    side,
    order_configuration,
  };

  // Dry run (always safe)
  if (action === "dry_run_order") {
    await logToSupabase({
      bot: "pulse",
      symbol: product_id,
      side,
      base_size: base_size ?? null,
      quote_size: quote_size ?? null,
      raw: {
        kind: "dry_run",
        action,
        gates: { COINBASE_TRADING_ENABLED: tradingEnabled, PULSE_TRADE_ARMED: armed },
        payload: orderPayload,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "DRY_RUN",
      gates: {
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
      would_call: "POST https://api.coinbase.com/api/v3/brokerage/orders",
      payload: orderPayload,
      note: liveAllowed
        ? "Dry-run only. If you call action=place_order, it WILL execute."
        : "Dry-run only. LIVE is blocked until BOTH gates are true.",
    });
  }

  // place_order requires BOTH gates true
  if (action !== "place_order") {
    return jsonError("Unknown action.", 400, { action });
  }
  if (!liveAllowed) {
    return jsonError(
      "LIVE blocked. Set COINBASE_TRADING_ENABLED=true AND PULSE_TRADE_ARMED=true.",
      403,
      { gates: { COINBASE_TRADING_ENABLED: tradingEnabled, PULSE_TRADE_ARMED: armed } }
    );
  }

  // Live call
  const path = "/api/v3/brokerage/orders";
  const token = buildCdpJwt("POST", path);

  try {
    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const text = await res.text();
    const parsed = safeJsonParse(text);

    // Try to grab an order id if present
    const orderId =
      parsed?.order_id ||
      parsed?.order?.order_id ||
      parsed?.success_response?.order_id ||
      null;

    await logToSupabase({
      bot: "pulse",
      symbol: product_id,
      side,
      base_size: base_size ?? null,
      quote_size: quote_size ?? null,
      order_id: orderId,
      raw: {
        kind: "live_order",
        action,
        gates: { COINBASE_TRADING_ENABLED: tradingEnabled, PULSE_TRADE_ARMED: armed },
        request: orderPayload,
        response_status: res.status,
        response: parsed ?? text,
      },
    });

    return NextResponse.json(
      {
        ok: res.ok,
        mode: "LIVE",
        gates: {
          COINBASE_TRADING_ENABLED: tradingEnabled,
          PULSE_TRADE_ARMED: armed,
          LIVE_ALLOWED: liveAllowed,
        },
        status: res.status,
        payload: orderPayload,
        coinbase: parsed ?? text,
      },
      { status: res.ok ? 200 : res.status }
    );
  } catch (e: any) {
    await logToSupabase({
      bot: "pulse",
      symbol: product_id,
      side,
      base_size: base_size ?? null,
      quote_size: quote_size ?? null,
      raw: {
        kind: "live_order_error",
        action,
        error: e?.message || String(e),
        payload: orderPayload,
      },
    });

    return jsonError(e?.message || "Live execution failed.", 500, { action });
  }
}
