// src/app/api/pulse-manager/route.ts
// Pulse Manager (EXITS ONLY - VR adaptive)
// - Reads current BTC position (balance)
// - Finds entry from last BUY in trade_logs (Supabase REST, if configured)
// - Pulls current price + recent candles from Coinbase
// - Computes simple Volatility + Regime
// - Applies Profit Protection (E1) first
// - Calls /api/pulse-trade ONLY if exit conditions are met AND gates are true
//
// SAFE BY DESIGN:
// - Will not trade unless BOTH gates are true:
//   COINBASE_TRADING_ENABLED=true AND PULSE_TRADE_ARMED=true
// - If it cannot confidently compute entry/position, it does nothing.

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

type Candle = { start: number; open: number; high: number; low: number; close: number; volume: number };

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function normalizePem(pem: string) {
  let p = pem.trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) p = p.slice(1, -1);
  p = p.replace(/\\n/g, "\n");
  p = p.replace(/\r\n/g, "\n");
  return p;
}

function buildCdpJwt(method: "GET" | "POST", path: string) {
  const apiKeyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKey = normalizePem(requireEnv("COINBASE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  // host-style uri (no scheme)
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

// Optional auth gate for cron/manual calls
function cronAuthorized(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function gates() {
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);
  return { tradingEnabled, armed, liveAllowed: tradingEnabled && armed };
}

// --- Coinbase helpers ---

async function cbGet(path: string) {
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
    parsed = text;
  }
  return { ok: res.ok, status: res.status, data: parsed };
}

async function getBestBidAsk(productId: string) {
  const path = `/api/v3/brokerage/products/${encodeURIComponent(productId)}/best_bid_ask`;
  const r = await cbGet(path);
  const bb = r.data?.best_bid_ask || r.data;
  const bid = Number(bb?.bids?.[0]?.price ?? bb?.bid ?? bb?.best_bid ?? NaN);
  const ask = Number(bb?.asks?.[0]?.price ?? bb?.ask ?? bb?.best_ask ?? NaN);
  const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
  return { ok: r.ok, status: r.status, bid, ask, mid, raw: r.data };
}

async function getCandles(productId: string, granularitySeconds = 300, limit = 48) {
  // Coinbase Advanced Trade candles endpoint: /api/v3/brokerage/products/{product_id}/candles
  // Some accounts may require start/end. We'll try the simple form first.
  const path = `/api/v3/brokerage/products/${encodeURIComponent(productId)}/candles?granularity=${granularitySeconds}`;
  const r = await cbGet(path);

  // Expecting: { candles: [...] } with strings or numbers
  const arr = r.data?.candles || r.data || [];
  const candles: Candle[] = Array.isArray(arr)
    ? arr
        .map((c: any) => ({
          start: Number(c?.start ?? c?.[0] ?? 0),
          open: Number(c?.open ?? c?.[1] ?? 0),
          high: Number(c?.high ?? c?.[2] ?? 0),
          low: Number(c?.low ?? c?.[3] ?? 0),
          close: Number(c?.close ?? c?.[4] ?? 0),
          volume: Number(c?.volume ?? c?.[5] ?? 0),
        }))
        .filter((c) => Number.isFinite(c.close) && c.close > 0)
    : [];

  // Keep most recent `limit`
  const sorted = candles.sort((a, b) => a.start - b.start);
  return { ok: r.ok, status: r.status, candles: sorted.slice(-limit), raw: r.data };
}

// --- Position + entry discovery ---
// Position = BTC available in account (simple, safe)
async function getPositionBase(asset = "BTC") {
  const r = await cbGet("/api/v3/brokerage/accounts");
  const accounts = r.data?.accounts || r.data;
  if (!Array.isArray(accounts)) return { ok: false, reason: "accounts_unreadable", raw: r.data };

  const acct = accounts.find((a: any) => (a?.currency || a?.available_balance?.currency) === asset);
  const avail = acct?.available_balance?.value ?? acct?.available_balance ?? acct?.available ?? null;
  const base = Number(avail);
  if (!Number.isFinite(base)) return { ok: false, reason: "btc_balance_nan", raw: acct };
  return { ok: true, base, raw: acct };
}

// Entry price = last BUY from trade_logs (Supabase REST) if service role is present
async function getLastEntryFromLogs(productId: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SRK) return { ok: false, reason: "supabase_logging_not_configured" };

  // Expect trade_logs has: bot, symbol, side, price (optional), raw (contains response)
  // We’ll attempt: last BUY for pulse + symbol, newest first
  const url =
    `${SUPABASE_URL.replace(/\/$/, "")}` +
    `/rest/v1/trade_logs?select=created_at,side,price,raw,base_size,quote_size` +
    `&bot=eq.pulse&symbol=eq.${encodeURIComponent(productId)}` +
    `&side=eq.BUY&order=created_at.desc&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, reason: "supabase_read_failed", status: res.status };
  const rows = (await res.json()) as any[];
  const row = rows?.[0];
  if (!row) return { ok: false, reason: "no_buy_logs_found" };

  // Try direct price column, else pull from raw response if present
  let entry = Number(row.price);
  if (!Number.isFinite(entry)) {
    const rp = row?.raw?.response;
    entry =
      Number(rp?.order?.average_filled_price) ||
      Number(rp?.success_response?.average_filled_price) ||
      Number(rp?.filled_average_price) ||
      Number(rp?.average_filled_price) ||
      NaN;
  }

  if (!Number.isFinite(entry)) return { ok: false, reason: "entry_price_unavailable", row };
  return { ok: true, entryPrice: entry, row };
}

// --- VR calculation (simple + robust) ---

function bps(move: number) {
  return move * 10000;
}

function computeVolatilityTier(candles: Candle[]) {
  if (candles.length < 10) return { tier: "unknown" as const, atrBps: null as number | null };

  // ATR proxy: average (high-low)/close
  const ranges = candles.slice(-20).map((c) => (c.high - c.low) / (c.close || 1));
  const avg = ranges.reduce((a, b) => a + b, 0) / Math.max(1, ranges.length);
  const atrBps = bps(avg);

  // Tunable bands
  // Low = sleepy, Medium = normal, High = fast
  let tier: "low" | "med" | "high" = "med";
  if (atrBps < 25) tier = "low";
  else if (atrBps > 80) tier = "high";

  return { tier, atrBps };
}

function computeRegime(candles: Candle[]) {
  if (candles.length < 20) return { regime: "unknown" as const, slopeBps: null as number | null };

  const closes = candles.slice(-24).map((c) => c.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const move = (last - first) / first;
  const slopeBps = bps(move);

  // Directional consistency: how many closes are up vs down
  let ups = 0;
  for (let i = 1; i < closes.length; i++) if (closes[i] > closes[i - 1]) ups++;
  const upRatio = ups / Math.max(1, closes.length - 1);

  // Basic regime classification
  // trending if slope meaningful and direction consistent
  if (Math.abs(slopeBps) >= 60 && (upRatio >= 0.62 || upRatio <= 0.38)) {
    return { regime: "trending" as const, slopeBps };
  }
  return { regime: "chop" as const, slopeBps };
}

// --- Exit decision (E1 only, adaptive) ---

function adaptiveProfitLockBps(volTier: "low" | "med" | "high" | "unknown", regime: "trending" | "chop" | "unknown") {
  // Base targets (bps)
  // We protect earlier in chop and low vol; later in trend & higher vol
  let target = 80; // default

  if (regime === "chop") target = 60;
  if (regime === "trending") target = 110;

  if (volTier === "low") target -= 15;
  if (volTier === "high") target += 25;

  // clamp
  target = Math.max(35, Math.min(180, target));
  return target;
}

// --- main tick ---

async function tick() {
  const productId = (process.env.PULSE_PRODUCT || "BTC-USD").trim();
  const minPos = Number(process.env.MIN_POSITION_BASE || "0.000001"); // ignore dust

  const { tradingEnabled, armed, liveAllowed } = gates();

  // 1) position
  const pos = await getPositionBase("BTC");
  if (!pos.ok) {
    return { ok: true, did: "no_op", reason: pos.reason, gates: { tradingEnabled, armed, liveAllowed } };
  }
  const positionBase = pos.base;

  if (positionBase < minPos) {
    return {
      ok: true,
      did: "no_op",
      reason: "no_position",
      product_id: productId,
      position_base: positionBase,
      gates: { tradingEnabled, armed, liveAllowed },
    };
  }

  // 2) price + candles
  const price = await getBestBidAsk(productId);
  if (!price.ok || !Number.isFinite(price.mid)) {
    return { ok: true, did: "no_op", reason: "price_unavailable", status: price.status, gates: { tradingEnabled, armed, liveAllowed } };
  }

  const candlesRes = await getCandles(productId, 300, 48);
  const candles = candlesRes.candles || [];
  const vol = computeVolatilityTier(candles);
  const reg = computeRegime(candles);

  // 3) entry
  const entry = await getLastEntryFromLogs(productId);
  if (!entry.ok) {
    // Safe behavior: do nothing if we can’t compute profit.
    return {
      ok: true,
      did: "no_op",
      reason: entry.reason,
      product_id: productId,
      position_base: positionBase,
      current_price: price.mid,
      vol,
      reg,
      gates: { tradingEnabled, armed, liveAllowed },
    };
  }

  const entryPrice = entry.entryPrice;
  const pnlBps = bps((price.mid - entryPrice) / entryPrice);

  const lockBps = adaptiveProfitLockBps(vol.tier as any, reg.regime as any);

  // E1 rule: if profit >= adaptive lock threshold, exit full position (simple + safe).
  // Later (E2/E3), we’ll add layered exits / trailing.
  const shouldExit = pnlBps >= lockBps;

  if (!shouldExit) {
    return {
      ok: true,
      did: "hold",
      product_id: productId,
      position_base: positionBase,
      entry_price: entryPrice,
      current_price: price.mid,
      pnl_bps: Number(pnlBps.toFixed(1)),
      profit_lock_bps: lockBps,
      vol,
      reg,
      gates: { tradingEnabled, armed, liveAllowed },
    };
  }

  // If we get here: exit signal is true, but still must obey live gates.
  if (!liveAllowed) {
    return {
      ok: true,
      did: "exit_signal_blocked_by_gates",
      product_id: productId,
      position_base: positionBase,
      entry_price: entryPrice,
      current_price: price.mid,
      pnl_bps: Number(pnlBps.toFixed(1)),
      profit_lock_bps: lockBps,
      vol,
      reg,
      gates: { tradingEnabled, armed, liveAllowed },
    };
  }

  // 4) Place SELL via internal route (pulse-trade)
  // IMPORTANT: internal call; no external exposure; still protected by pulse-trade gates too.
  const r = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/pulse-trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: reqInternalAuth() },
    body: JSON.stringify({
      action: "place_order",
      product_id: productId,
      side: "SELL",
      base_size: positionBase.toFixed(8), // Coinbase accepts string decimals; we keep safe precision
    }),
    cache: "no-store",
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ ok: false, error: e?.message || String(e) }) } as any));

  let out: any = null;
  try {
    out = await r.json();
  } catch {
    out = { ok: false, error: "pulse-trade returned non-json" };
  }

  return {
    ok: true,
    did: "exit_sent",
    product_id: productId,
    position_base: positionBase,
    entry_price: entryPrice,
    current_price: price.mid,
    pnl_bps: Number(pnlBps.toFixed(1)),
    profit_lock_bps: lockBps,
    vol,
    reg,
    pulse_trade: out,
    gates: { tradingEnabled, armed, liveAllowed },
  };
}

// Internal auth helper for calling our own route
function reqInternalAuth() {
  const secret = (process.env.CRON_SECRET || "").trim();
  // If you’ve set CRON_SECRET, we reuse it as internal auth.
  // If not set, return empty string (and the downstream route should allow).
  return secret ? `Bearer ${secret}` : "";
}

// GET = status (or tick with ?tick=1)
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const doTick = url.searchParams.get("tick") === "1";

  if (!doTick) {
    const { tradingEnabled, armed, liveAllowed } = gates();
    return json(200, {
      ok: true,
      status: "PULSE_MANAGER_READY",
      mode: "EXITS_ONLY_VR",
      gates: { COINBASE_TRADING_ENABLED: tradingEnabled, PULSE_TRADE_ARMED: armed, LIVE_ALLOWED: liveAllowed },
      hint: "Call /api/pulse-manager?tick=1 to run one decision tick.",
    });
  }

  try {
    const result = await tick();
    return json(200, result);
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
}

// POST = tick (preferred for cron)
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return json(401, { ok: false, error: "unauthorized" });

  try {
    const result = await tick();
    return json(200, result);
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
}
