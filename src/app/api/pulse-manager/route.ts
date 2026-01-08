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
// - Places SELL via Pulse Trade (maker by default through envs used in pulse-trade)
//
// Flags:
//   BOT_ENABLED=true
//   COINBASE_TRADING_ENABLED=true
//   PULSE_TRADE_ARMED=true
//   PULSE_EXITS_ENABLED=true   <-- controls exits only
//
// Optional safety:
//   PULSE_EXITS_DRY_RUN=true   <-- compute decision, DO NOT place order
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

  // ✅ CRITICAL: uri claim should NOT include query string (avoids 401 on endpoints w/ params)
  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

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
  // Advanced Trade: historical fills
  // IMPORTANT: use product_ids (not product_id). Filter to BUY, sorted by TRADE_TIME.
  const path = `/api/v3/brokerage/orders/historical/fills?product_ids=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=100&order_side=BUY&sort_by=TRADE_TIME`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const fills = (r.json as any)?.fills || (r.json as any)?.fill || [];
  if (!Array.isArray(fills) || fills.length === 0) {
    return { ok: false, error: "no_fills_found" };
  }

  const buy = fills.find((f: any) => String(f?.side || "").toUpperCase() === "BUY") || fills[0];
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
  const end = new Date();

  // ✅ FIX: normalize entry time into a valid Date, else fallback to 2h ago
  let start = new Date(isoTime);
  if (!Number.isFinite(start.getTime())) {
    // try parsing numeric epoch strings
    const asNum = Number(isoTime);
    if (Number.isFinite(asNum) && asNum > 0) {
      start = new Date(asNum);
    }
  }
  if (!Number.isFinite(start.getTime())) {
    start = new Date(end.getTime() - 2 * 3600 * 1000); // fallback 2h
  }

  // safety clamp: max lookback 48h (keeps payload small)
  if (end.getTime() - start.getTime() > 48 * 3600 * 1000) {
    start = new Date(end.getTime() - 48 * 3600 * 1000);
  }

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const gran = optEnv("PULSE_CANDLE_GRANULARITY") || "ONE_MINUTE";
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    PRODUCT_ID
  )}/candles?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(
    endIso
  )}&granularity=${encodeURIComponent(gran)}`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const candles = (r.json as any)?.candles || [];
  if (!Array.isArray(candles) || candles.length === 0) {
    return { ok: false, error: "no_candles" };
  }

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
  // Forward cron auth so pulse-trade accepts internal calls
  const site =
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://yieldcraft.co").replace(
      /\/$/,
      ""
    );
  const url = `${site}/api/pulse-trade`;

  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cronSecret) {
    headers["x-cron-secret"] = cronSecret;
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
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
  const exitsDryRun = truthy(process.env.PULSE_EXITS_DRY_RUN);

  const profitTargetBps = num(process.env.PROFIT_TARGET_BPS, 120);
  const trailArmBps = num(process.env.TRAIL_ARM_BPS, 150);
  const trailOffsetBps = num(process.env.TRAIL_OFFSET_BPS, 50);

  const position = await fetchBtcPosition();

  const gates = {
    BOT_ENABLED: botEnabled,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    PULSE_EXITS_ENABLED: exitsEnabled,
    PULSE_EXITS_DRY_RUN: exitsDryRun,
    LIVE_ALLOWED: botEnabled && tradingEnabled && armed,
  };

  if (!gates.LIVE_ALLOWED) {
    return {
      ok: true,
      mode: "NOOP_GATES",
      gates,
      position,
      note: "Manager did not trade because gates are not fully enabled.",
    };
  }

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

  const baseSize = fmtBaseSize(position.base_available);

  if (exitsDryRun) {
    return {
      ok: true,
      mode: "DRY_RUN_SELL",
      gates,
      position,
      decision,
      would_sell_base_size: baseSize,
      note: "PULSE_EXITS_DRY_RUN=true so no order was placed.",
    };
  }

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

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const action = String(body?.action || "run").toLowerCase();

  if (action === "status") {
    const position = await fetchBtcPosition();
    const gates = {
      BOT_ENABLED: truthy(process.env.BOT_ENABLED),
      COINBASE_TRADING_ENABLED: truthy(process.env.COINBASE_TRADING_ENABLED),
      PULSE_TRADE_ARMED: truthy(process.env.PULSE_TRADE_ARMED),
      PULSE_EXITS_ENABLED: truthy(process.env.PULSE_EXITS_ENABLED),
      PULSE_EXITS_DRY_RUN: truthy(process.env.PULSE_EXITS_DRY_RUN),
    };
    return json(200, {
      ok: true,
      status: "PULSE_MANAGER_READY",
      gates,
      position,
      note: "Use GET or POST (default) to execute exit logic (if enabled).",
    });
  }

  const result = await runManager();
  return json(result.ok ? 200 : 500, result);
}
