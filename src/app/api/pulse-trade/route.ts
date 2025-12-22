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

import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";
type Action = "status" | "dry_run_order" | "place_order";

// -------------------- helpers --------------------

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
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

// -------------------- Coinbase JWT --------------------

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
  try {
    const path = "/api/v3/brokerage/accounts";
    const token = buildCdpJwt("GET", path);

    const res = await fetch(`https://api.coinbase.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();

    const btc = json?.accounts?.find(
      (a: any) => a.currency === "BTC"
    );

    const available = Number(btc?.available_balance?.value || 0);

    return {
      ok: true,
      has_position: available > 0,
      base_available: available,
    };
  } catch {
    return {
      ok: false,
      has_position: false,
      base_available: 0,
    };
  }
}

// -------------------- GET --------------------

export async function GET(req: NextRequest) {
  const { tradingEnabled, armed, liveAllowed } = gates();

  return json(200, {
    ok: true,
    status: "PULSE_TRADE_READY",
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

  if (action === "status") {
    return json(200, {
      ok: true,
      status: "PULSE_TRADE_READY",
      gates: {
        COINBASE_TRADING_ENABLED: tradingEnabled,
        PULSE_TRADE_ARMED: armed,
        LIVE_ALLOWED: liveAllowed,
      },
    });
  }

  const product_id = "BTC-USD";
  const side = String(body?.side || "BUY").toUpperCase() as Side;
  const quote_size = body?.quote_size ? String(body.quote_size) : null;
  const base_size = body?.base_size ? String(body.base_size) : null;

  const position = await fetchBtcPosition();

  // -------------------- POSITION RULES --------------------

  if (side === "BUY" && position.has_position) {
    return jsonError("BUY blocked: BTC position already exists.", 409, {
      position,
    });
  }

  if (side === "SELL" && !position.has_position) {
    return jsonError("SELL blocked: no BTC position to exit.", 409, {
      position,
    });
  }

  const client_order_id = `yc_${action}_${Date.now()}`;

  const order_configuration =
    side === "BUY"
      ? { market_market_ioc: { quote_size } }
      : { market_market_ioc: { base_size } };

  const payload = {
    client_order_id,
    product_id,
    side,
    order_configuration,
  };

  if (action === "dry_run_order") {
    return json(200, {
      ok: true,
      mode: "DRY_RUN",
      position,
      gates: { tradingEnabled, armed, liveAllowed },
      payload,
    });
  }

  if (!liveAllowed) {
    return jsonError("LIVE blocked by gates.", 403, { gates });
  }

  const path = "/api/v3/brokerage/orders";
  const token = buildCdpJwt("POST", path);

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
    position,
    payload,
    coinbase: parsed ?? text,
  });
}
