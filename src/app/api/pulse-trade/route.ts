// src/app/api/pulse-trade/route.ts
// Pulse Trade: Coinbase Advanced Trade order router
//
// Actions:
//   - status
//   - dry_run_order
//   - place_order
//
// SAFETY GATES (BOTH must be true to place live orders):
//   1) COINBASE_TRADING_ENABLED=true
//   2) PULSE_TRADE_ARMED=true
//
// NOTE:
// - Vercel Cron calls GET. GET can optionally trigger an internal POST when ?cron=1.
// - It will NOT place trades from a normal browser GET (no ?cron=1).
// - Add CRON_SECRET to restrict access (recommended).

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";
type Action = "status" | "dry_run_order" | "place_order";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// -------------------- small helpers --------------------

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

  // Strip surrounding quotes (common when env var is pasted with quotes)
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }

  // Convert literal "\n" into real newlines
  p = p.replace(/\\n/g, "\n");

  // Normalize CRLF -> LF
  p = p.replace(/\r\n/g, "\n");

  return p;
}

/**
 * Optional Cron auth:
 * If CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET>
 */
function cronAuthorized(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true; // no secret configured = allow
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function cronSecretHeaderValue() {
  const secret = (process.env.CRON_SECRET || "").trim();
  return secret ? `Bearer ${secret}` : "";
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

  // NOTE: assumes ES256 key.
  return jwt.sign(payload, privateKey as any, {
    algorithm: "ES256",
    header: { kid: apiKeyName, nonce } as any,
  });
}

// -------------------- Supabase logging (non-blocking) --------------------

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

    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/trade_logs`;

    const payload = {
      bot: row.bot,
      symbol: row.symbol ?? null,
      side: row.side ?? null,
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

// -------------------- GET (status / cron-safe + optional auto-trade) --------------------

export async function GET(req: Request) {
  // Optional: lock cron access
  if (!cronAuthorized(req)) {
    console.log("[PULSE_TRADE] GET blocked (bad cron auth)");
    return jsonError("Unauthorized (cron).", 401);
  }

  const { tradingEnabled, armed, liveAllowed } = gates();

  const url = new URL(req.url);
  const isCron =
    url.searchParams.get("cron") === "1" || req.headers.get("x-vercel-cron") === "1";

  console.log("[PULSE_TRADE] GET status", {
    isCron,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    LIVE_ALLOWED: liveAllowed,
    at: new Date().toISOString(),
  });

  // Only auto-execute when it is a cron invocation AND gates are true
  if (isCron && liveAllowed) {
    // Optional light cooldown guard (helps avoid accidental double-fires)
    const key = "__pulse_trade_last_run__";
    const g: any = globalThis as any;
    const last = typeof g[key] === "number" ? g[key] : 0;
    const now = Date.now();
    const cooldownMs = Number(process.env.PULSE_TRADE_COOLDOWN_MS || "60000");
    if (now - last < cooldownMs) {
      console.log("[PULSE_TRADE] Cron skipped due to cooldown", {
        since_ms: now - last,
        cooldownMs,
      });
      return json(200, {
        ok: true,
        status: "SKIPPED_COOLDOWN",
        cooldownMs,
        since_ms: now - last,
      });
    }
    g[key] = now;

    // Defaults for cron trade (safe small buy)
    const product_id = String(process.env.PULSE_TRADE_PRODUCT || "BTC-USD");
    const quote_size = String(process.env.PULSE_TRADE_QUOTE_SIZE || "1.00");

    console.log("[PULSE_TRADE] Cron triggering internal POST place_order", {
      product_id,
      quote_size,
    });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const cronAuth = cronSecretHeaderValue();
    if (cronAuth) headers["authorization"] = cronAuth;

    const internalReq = new Request(req.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "place_order",
        product_id,
        side: "BUY",
        quote_size,
      }),
    });

    return await POST(internalReq);
  }

  // Normal GET status response (no trades)
  return json(200, {
    ok: true,
    status: "PULSE_TRADE_READY",
    note: isCron
      ? liveAllowed
        ? "Cron-ready: would auto-trade on this GET, but reached status path."
        : "Cron hit, but LIVE is blocked until BOTH gates are true."
      : "Status only. Add ?cron=1 for cron invocations.",
    gates: {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
      LIVE_ALLOWED: liveAllowed,
    },
  });
}

// -------------------- POST (status / dry-run / live order) --------------------

export async function POST(req: Request) {
  // Optional: lock cron access (keeps public from spamming POST)
  if (!cronAuthorized(req)) {
    console.log("[PULSE_TRADE] POST blocked (bad cron auth)");
    return jsonError("Unauthorized (cron).", 401);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const action = (body?.action || "status") as Action;
  const { tradingEnabled, armed, liveAllowed } = gates();

  console.log("[PULSE_TRADE] POST received", {
    action,
    gates: {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
      LIVE_ALLOWED: liveAllowed,
    },
    at: new Date().toISOString(),
  });

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
    if (!quote_size)
      return jsonError('BUY requires quote_size (e.g. "1.00").', 400);
    order_configuration = { market_market_ioc: { quote_size } };
  } else {
    if (!base_size)
      return jsonError('SELL requires base_size (e.g. "0.00001").', 400);
    order_configuration = { market_market_ioc: { base_size } };
  }

  const orderPayload = {
    client_order_id,
    product_id,
    side,
    order_configuration,
  };

  // -------------------- DRY RUN --------------------
  if (action === "dry_run_order") {
    console.log("[PULSE_TRADE] DRY_RUN", {
      product_id,
      side,
      quote_size,
      base_size,
      liveAllowed,
    });

    await logToSupabase({
      bot: "pulse",
      symbol: product_id,
      side,
      base_size: base_size ?? null,
      quote_size: quote_size ?? null,
      raw: {
        kind: "dry_run",
        action,
        gates: {
          COINBASE_TRADING_ENABLED: tradingEnabled,
          PULSE_TRADE_ARMED: armed,
          LIVE_ALLOWED: liveAllowed,
        },
        payload: orderPayload,
      },
    });

    return json(200, {
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

  // -------------------- LIVE ORDER --------------------
  if (action !== "place_order") {
    console.log("[PULSE_TRADE] Unknown action", { action });
    return jsonError("Unknown action.", 400, { action });
  }

  if (!liveAllowed) {
    console.log("[PULSE_TRADE] LIVE blocked by gates", {
      COINBASE_TRADING_ENABLED: tradingEnabled,
      PULSE_TRADE_ARMED: armed,
    });

    return jsonError(
      "LIVE blocked. Set COINBASE_TRADING_ENABLED=true AND PULSE_TRADE_ARMED=true.",
      403,
      {
        gates: {
          COINBASE_TRADING_ENABLED: tradingEnabled,
          PULSE_TRADE_ARMED: armed,
          LIVE_ALLOWED: liveAllowed,
        },
      }
    );
  }

  console.log("[PULSE_TRADE] LIVE attempt", {
    product_id,
    side,
    quote_size,
    base_size,
    client_order_id,
  });

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

    const orderId =
      parsed?.order_id ||
      parsed?.order?.order_id ||
      parsed?.success_response?.order_id ||
      null;

    console.log("[PULSE_TRADE] LIVE response", {
      ok: res.ok,
      status: res.status,
      order_id: orderId,
    });

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
        gates: {
          COINBASE_TRADING_ENABLED: tradingEnabled,
          PULSE_TRADE_ARMED: armed,
          LIVE_ALLOWED: liveAllowed,
        },
        request: orderPayload,
        response_status: res.status,
        response: parsed ?? text,
      },
    });

    return json(res.ok ? 200 : res.status, {
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
    });
  } catch (e: any) {
    console.log("[PULSE_TRADE] LIVE error", { message: e?.message || String(e) });

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
