// src/app/api/pulse-manager/route.ts
// Pulse Manager — authenticated “real trading” runner (cron-safe)
// - Keeps /api/pulse-heartbeat public + safe.
// - This route is PRIVATE (requires CRON_SECRET).
//
// What it does (when enabled):
// - Reads current position (BTC-USD)
// - If a position exists AND PULSE_EXITS_ENABLED=true:
//     • Take-profit at PROFIT_TARGET_BPS
//     • Trailing stop: arm at TRAIL_ARM_BPS, trail by TRAIL_OFFSET_BPS using candles peak
// - Places SELL via Coinbase (maker by default through envs used in pulse-trade)
//
// Flags:
//   BOT_ENABLED=true
//   COINBASE_TRADING_ENABLED=true
//   PULSE_TRADE_ARMED=true
//   PULSE_EXITS_ENABLED=true   <-- NEW (controls exits only)
//
// Notes:
// - This does NOT “invent” AI. It’s the safety/exit layer.
// - It does NOT require a DB: derives entry + peak from Coinbase fills + candles.
// - Uses signed Coinbase CDP JWT (same style as pulse-trade).

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

const PRODUCT_ID = "BTC-USD";

// ---------- helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}
function minPositionBaseBtc() {
  const raw = (process.env.PULSE_MIN_POSITION_BASE_BTC || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 0.000001;
}
function fmtBaseSize(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(8).replace(/\.?0+$/, "");
}

function okAuth(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.PULSE_MANAGER_SECRET || "";
  if (!secret) return false;

  // allow either header or query param
  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-pulse-secret") ||
    req.headers.get("authorization");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

// ---------- Coinbase CDP JWT ----------
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

async function cbFetch(path: string) {
  const token = buildCdpJwt("GET", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, json: parsed, text };
}

// ---------- position ----------
async function fetchBtcPosition() {
  const path = "/api/v3/brokerage/accounts";
  const r = await cbFetch(path);

  if (!r.ok) {
    return {
      ok: false as const,
      has_position: false,
      base_available: 0,
      status: r.status,
      coinbase: r.json ?? r.text,
    };
  }

  const accounts = (r.json as any)?.accounts || [];
  const btc = accounts.find((a: any) => a?.currency === "BTC");
  const available = Number(btc?.available_balance?.value || 0);

  const minPos = minPositionBaseBtc();
  return {
    ok: true as const,
    has_position: Number.isFinite(available) && available >= minPos,
    base_available: Number.isFinite(available) ? available : 0,
    min_pos: minPos,
  };
}

// ---------- entry price from fills ----------
async function fetchEntryFromFills(): Promise<
  | { ok: true; entryPrice: number; entryTime: string; entryQty: number }
  | { ok: false; error: any }
> {
  // Coinbase endpoint: historical fills
  // We’ll take the most recent BUY fill for BTC-USD as the “entry”.
  const path = `/api/v3/brokerage/orders/historical/fills?product_id=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=100`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const fills = (r.json as any)?.fills || (r.json as any)?.fill || [];
  if (!Array.isArray(fills) || fills.length === 0) {
    return { ok: false, error: "no_fills_found" };
  }

  // find last BUY fill
  const buy = fills.find((f: any) => String(f?.side || "").toUpperCase() === "BUY");
  if (!buy) return { ok: false, error: "no_buy_fill_found" };

  const px = Number(buy?.price || buy?.fill_price || 0);
  const qty = Number(buy?.size || buy?.filled_size || buy?.base_size || 0);
  const t = String(buy?.trade_time || buy?.created_time || buy?.time || "");

  if (!Number.isFinite(px) || px <= 0) return { ok: false, error: { bad_price: buy } };

  return { ok: true, entryPrice: px, entryTime: t || new Date().toISOString(), entryQty: qty };
}

// ---------- peak price since entry via candles ----------
async function fetchPeakSince(isoTime: string): Promise<
  | { ok: true; peak: number; last: number }
  | { ok: false; error: any }
> {
  // Coinbase candles endpoint (Advanced Trade):
  // /products/{product_id}/candles?start=...&end=...&granularity=...
  // Use 1-minute candles by default, fallback to 5m if needed.
  const end = new Date();
  const start = new Date(isoTime);
  // safety clamp: max lookback 48h (keeps payload small)
  if (end.getTime() - start.getTime() > 48 * 3600 * 1000) {
    start.setTime(end.getTime() - 48 * 3600 * 1000);
  }

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const gran = optEnv("PULSE_CANDLE_GRANULARITY") || "ONE_MINUTE";
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    PRODUCT_ID
  )}/candles?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&granularity=${encodeURIComponent(
    gran
  )}`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const candles = (r.json as any)?.candles || [];
  if (!Array.isArray(candles) || candles.length === 0) {
    return { ok: false, error: "no_candles" };
  }

  // candle shape varies; handle common fields:
  // { high, low, open, close } OR arrays
  let peak = 0;
  let last = 0;

  for (const c of candles) {
    const high = Number((c as any)?.high ?? (c as any)?.h ?? 0);
    const close = Number((c as any)?.close ?? (c as any)?.c ?? 0);
    if (Number.isFinite(high) && high > peak) peak = high;
    if (Number.isFinite(close) && close > 0) last = close;
  }

  if (!peak || peak <= 0) return { ok: false, error: { bad_peak: candles[0] } };
  if (!last || last <= 0) last = peak;

  return { ok: true, peak, last };
}

// ---------- place SELL via pulse-trade ----------
async function placeSell(baseSize: string) {
  // Use internal endpoint so all gates/formatting stay consistent
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || "https://yieldcraft.co"}/api/pulse-trade`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "place_order",
      side: "SELL",
      base_size: baseSize,
    }),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return { ok: res.ok, status: res.status, data: parsed ?? text };
}

// ---------- main runner ----------
async function runManager() {
  const botEnabled = truthy(process.env.BOT_ENABLED);
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);
  const exitsEnabled = truthy(process.env.PULSE_EXITS_ENABLED);

  const profitTargetBps = num(process.env.PROFIT_TARGET_BPS, 120);
  const trailArmBps = num(process.env.TRAIL_ARM_BPS, 150);
  const trailOffsetBps = num(process.env.TRAIL_OFFSET_BPS, 50);

  const position = await fetchBtcPosition();

  const gates = {
    BOT_ENABLED: botEnabled,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    PULSE_EXITS_ENABLED: exitsEnabled,
    LIVE_ALLOWED: botEnabled && tradingEnabled && armed,
  };

  // If not live allowed, do nothing (but still report)
  if (!gates.LIVE_ALLOWED) {
    return {
      ok: true,
      mode: "NOOP_GATES",
      gates,
      position,
      note: "Manager did not trade because gates are not fully enabled.",
    };
  }

  // Only exits in this manager (for now)
  if (!position.ok) {
    return { ok: false, mode: "BLOCKED", gates, error: "cannot_read_position", position };
  }

  if (!position.has_position) {
    return {
      ok: true,
      mode: "NO_POSITION",
      gates,
      position,
      note: "No BTC position -> exits skipped.",
    };
  }

  if (!exitsEnabled) {
    return {
      ok: true,
      mode: "HOLD_EXITS_DISABLED",
      gates,
      position,
      note: "BTC position exists but exits are disabled (PULSE_EXITS_ENABLED=false).",
    };
  }

  // Derive entry + peak + current
  const entry = await fetchEntryFromFills();
  if (!entry.ok) {
    return { ok: false, mode: "BLOCKED", gates, position, error: "cannot_read_entry", entry };
  }

  const peak = await fetchPeakSince(entry.entryTime);
  if (!peak.ok) {
    return { ok: false, mode: "BLOCKED", gates, position, error: "cannot_read_peak", peak };
  }

  const entryPrice = entry.entryPrice;
  const current = peak.last;
  const peakPrice = peak.peak;

  const pnlBps = ((current - entryPrice) / entryPrice) * 10_000;
  const drawdownFromPeakBps = ((peakPrice - current) / peakPrice) * 10_000;

  const shouldTakeProfit = pnlBps >= profitTargetBps;
  const trailArmed = pnlBps >= trailArmBps;
  const shouldTrailStop = trailArmed && drawdownFromPeakBps >= trailOffsetBps;

  const decision = {
    entryPrice,
    current,
    peakPrice,
    pnlBps: Number(pnlBps.toFixed(2)),
    drawdownFromPeakBps: Number(drawdownFromPeakBps.toFixed(2)),
    profitTargetBps,
    trailArmBps,
    trailOffsetBps,
    shouldTakeProfit,
    trailArmed,
    shouldTrailStop,
  };

  if (!shouldTakeProfit && !shouldTrailStop) {
    return {
      ok: true,
      mode: "HOLD",
      gates,
      position,
      decision,
      note: "Exit conditions not met.",
    };
  }

  // SELL entire available position (above dust)
  const baseSize = fmtBaseSize(position.base_available);

  const sell = await placeSell(baseSize);

  return {
    ok: sell.ok,
    mode: "EXIT_SELL",
    gates,
    position,
    decision,
    sell,
  };
}

// ---------- handlers ----------
export async function GET(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });
  const result = await runManager();
  return json(result.ok ? 200 : 500, result);
}

export async function POST(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  // POST lets you optionally call with { action: "status" | "run" }
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const action = String(body?.action || "run").toLowerCase();

  if (action === "status") {
    return json(200, {
      ok: true,
      status: "PULSE_MANAGER_READY",
      note: "Use GET/POST action=run to execute exit logic (if enabled).",
    });
  }

  const result = await runManager();
  return json(result.ok ? 200 : 500, result);
}
