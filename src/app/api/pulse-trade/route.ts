// src/app/api/pulse-trade/route.ts
// Pulse Trade — Position-aware Coinbase Advanced Trade execution
//
// Actions:
//   - status
//   - dry_run_order
//   - place_order
//
// SAFETY GATES (BOTH required for LIVE):
//   1) COINBASE_TRADING_ENABLED=true
//   2) PULSE_TRADE_ARMED=true
//
// DESIGN:
// - Single-position only (BTC-USD)
// - BUY only if no BTC position
// - SELL only if BTC position exists
// - Read-only position snapshot before execution (cannot trade)
//
// OPTIONAL (does nothing unless enabled):
// - PULSE_ORDER_MODE=market|maker   (default: market)
// - MAKER_OFFSET_BPS=1.0            (default: 1.0)
// - MAKER_TIMEOUT_MS=15000          (default: 15000)

import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";
type Action = "status" | "dry_run_order" | "place_order";

type OrderMode = "market" | "maker";

// -------------------- helpers --------------------

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(message: string, status = 400, extra: any = {}) {
  return json(status, { ok: false, error: message, ...extra });
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

function optEnv(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function normalizePem(pem: string) {
  let p = pem.trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function gates() {
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);
  const liveAllowed = tradingEnabled && armed;
  return { tradingEnabled, armed, liveAllowed };
}

function getOrderMode(): OrderMode {
  const m = (optEnv("PULSE_ORDER_MODE") || "market").toLowerCase();
  return m === "maker" ? "maker" : "market";
}

function mustOneOf<T extends string>(value: any, allowed: readonly T[], fallback: T): T {
  const v = String(value || "").toUpperCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// -------------------- Coinbase JWT (CDP) --------------------
// NOTE: host-style uri: "METHOD api.coinbase.com/path"

function buildCdpJwt(method: "GET" | "POST", path: string) {
  const apiKeyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKey = normalizePem(requireEnv("COINBASE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");
  const uri = `${method} api.coinbase.com${path}`;

  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKey as any,
    { algorithm: "ES256", header: { kid: apiKeyName, nonce } as any }
  );
}

// -------------------- POSITION SNAPSHOT (READ-ONLY) --------------------

async function fetchBtcPosition() {
  const path = "/api/v3/brokerage/accounts";
  try {
    const token = buildCdpJwt("GET", path);

    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const text = await res.text();
    const parsed = safeJsonParse(text);

    if (!res.ok) {
      return {
        ok: false,
        has_position: false,
        base_available: 0,
        status: res.status,
        coinbase: parsed ?? text,
      };
    }

    const accounts = (parsed as any)?.accounts || [];
    const btc = accounts.find((a: any) => a?.currency === "BTC");

    const available = Number(btc?.available_balance?.value || 0);

    return {
      ok: true,
      has_position: available > 0,
      base_available: available,
    };
  } catch (e: any) {
    return {
      ok: false,
      has_position: false,
      base_available: 0,
      error: String(e?.message || e || "position_fetch_failed"),
    };
  }
}

// -------------------- MARKET PRICE (for maker) --------------------
// Used only when PULSE_ORDER_MODE=maker

async function fetchBestAskBid(product_id: string) {
  const path = `/api/v3/brokerage/products/${encodeURIComponent(product_id)}/book?limit=1`;
  try {
    const token = buildCdpJwt("GET", path);
    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const text = await res.text();
    const parsed = safeJsonParse(text);

    if (!res.ok) return { ok: false, status: res.status, coinbase: parsed ?? text };

    const bids = (parsed as any)?.pricebook?.bids || [];
    const asks = (parsed as any)?.pricebook?.asks || [];
    const bestBid = Number(bids?.[0]?.price || 0);
    const bestAsk = Number(asks?.[0]?.price || 0);

    return { ok: true, bestBid, bestAsk };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e || "book_fetch_failed") };
  }
}

function bpsAdjust(price: number, bps: number, direction: "down" | "up") {
  const mult = 1 + (direction === "up" ? 1 : -1) * (bps / 10000);
  return Math.max(0, price * mult);
}

// -------------------- GET --------------------

export async function GET(_req: NextRequest) {
  const { tradingEnabled, armed, liveAllowed } = gates();
  const orderMode = getOrderMode();

  return json(200, {
    ok: true,
    status: "PULSE_TRADE_READY",
    mode: orderMode,
    gates: {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
      LIVE_ALLOWED: liveAllowed,
    },
  });
}

// -------------------- POST --------------------

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const action = (body?.action || "status") as Action;
  const { tradingEnabled, armed, liveAllowed } = gates();
  const orderMode = getOrderMode();

  if (action === "status") {
    return json(200, {
      ok: true,
      status: "PULSE_TRADE_READY",
      mode: orderMode,
      gates: {
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
    });
  }

  const product_id = "BTC-USD";
  const side = mustOneOf<Side>(body?.side, ["BUY", "SELL"] as const, "BUY");

  const quote_size = body?.quote_size != null ? String(body.quote_size) : null;
  const base_size = body?.base_size != null ? String(body.base_size) : null;

  // Validate sizes before doing anything expensive
  if (side === "BUY") {
    const q = Number(quote_size);
    if (!quote_size || !Number.isFinite(q) || q <= 0) {
      return jsonError("BUY requires quote_size > 0 (e.g., \"1.00\").", 400, {
        got: { quote_size },
      });
    }
  } else {
    const b = Number(base_size);
    if (!base_size || !Number.isFinite(b) || b <= 0) {
      return jsonError("SELL requires base_size > 0 (e.g., \"0.00002\").", 400, {
        got: { base_size },
      });
    }
  }

  const position = await fetchBtcPosition();

  // If we can't read position, block LIVE (but still allow DRY_RUN)
  if (!position.ok && action === "place_order") {
    return jsonError("LIVE blocked: cannot verify BTC position snapshot.", 503, {
      position,
    });
  }

  // -------------------- POSITION RULES --------------------

  if (side === "BUY" && position.has_position) {
    return jsonError("BUY blocked: BTC position already exists.", 409, { position });
  }

  if (side === "SELL" && !position.has_position) {
    return jsonError("SELL blocked: no BTC position to exit.", 409, { position });
  }

  const client_order_id = `yc_${action}_${Date.now()}`;

  // -------------------- Build payload --------------------

  let payload: any;

  if (orderMode === "market") {
    // MARKET IOC (current behavior)
    payload = {
      client_order_id,
      product_id,
      side,
      order_configuration:
        side === "BUY"
          ? { market_market_ioc: { quote_size } }
          : { market_market_ioc: { base_size } },
    };
  } else {
    // MAKER post-only limit (only if enabled via env)
    const offsetBps = num(optEnv("MAKER_OFFSET_BPS"), 1.0);
    const timeoutMs = Math.max(1000, num(optEnv("MAKER_TIMEOUT_MS"), 15000));

    const book = await fetchBestAskBid(product_id);
    if (!book.ok) {
      return jsonError("Maker mode blocked: cannot fetch order book.", 503, { book });
    }

    const refPrice = side === "BUY" ? book.bestAsk : book.bestBid;
    if (!refPrice || refPrice <= 0) {
      return jsonError("Maker mode blocked: invalid reference price.", 503, { book });
    }

    const limitPrice =
      side === "BUY"
        ? bpsAdjust(refPrice, offsetBps, "down") // buy slightly below
        : bpsAdjust(refPrice, offsetBps, "up");  // sell slightly above

    // Coinbase expects string prices/sizes
    payload = {
      client_order_id,
      product_id,
      side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: side === "BUY" ? undefined : base_size,
          quote_size: side === "BUY" ? quote_size : undefined,
          limit_price: String(limitPrice),
          post_only: true,
        },
      },
      // Manager can choose to cancel/replace externally; we only place here.
      // timeoutMs is returned for visibility.
      _maker: { refPrice, limitPrice, offsetBps, timeoutMs },
    };
  }

  if (action === "dry_run_order") {
    return json(200, {
      ok: true,
      mode: "DRY_RUN",
      orderMode,
      position,
      gates: { tradingEnabled, armed, liveAllowed },
      payload,
    });
  }

  if (!liveAllowed) {
    return jsonError("LIVE blocked by gates.", 403, {
      gates: { COINBASE_TRADING_ENABLED: tradingEnabled, PULSE_TRADE_ARMED: armed },
    });
  }

  // -------------------- LIVE place --------------------

  const path = "/api/v3/brokerage/orders";
  let token: string;

  try {
    token = buildCdpJwt("POST", path);
  } catch (e: any) {
    return jsonError("JWT build failed (missing/invalid env).", 500, {
      error: String(e?.message || e),
    });
  }

  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);

  return json(res.ok ? 200 : res.status, {
    ok: res.ok,
    mode: "LIVE",
    orderMode,
    position,
    payload,
    coinbase: parsed ?? text,
  });
}
