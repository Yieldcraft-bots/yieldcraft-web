// src/app/api/pulse-manager/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

const PRODUCT_ID = "BTC-USD";

// ---------- helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
function fmtQuoteSizeUsd(x: number) {
  const v = Math.max(0, x);
  return v.toFixed(2);
}
function nowIso() {
  return new Date().toISOString();
}
function msSince(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

// ---------- auth ----------
function okAuth(req: Request) {
  // accept either CRON_SECRET or PULSE_MANAGER_SECRET
  const secret = (process.env.CRON_SECRET || process.env.PULSE_MANAGER_SECRET || "").trim();
  if (!secret) return false;

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

  // uri claim should NOT include query string
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
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

// ---------- position ----------
async function fetchBtcPosition() {
  const r = await cbFetch("/api/v3/brokerage/accounts");

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

// ---------- last BUY fill (for entry price + cooldown) ----------
async function fetchLastBuyFill(): Promise<
  | { ok: true; entryPrice: number; entryTime: string; entryQty: number }
  | { ok: false; error: any }
> {
  const path = `/api/v3/brokerage/orders/historical/fills?product_ids=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=100&order_side=BUY&sort_by=TRADE_TIME`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const fills = (r.json as any)?.fills || (r.json as any)?.fill || [];
  if (!Array.isArray(fills) || fills.length === 0)
    return { ok: false, error: "no_fills_found" };

  const buy =
    fills.find((f: any) => String(f?.side || "").toUpperCase() === "BUY") ||
    fills[0];
  if (!buy) return { ok: false, error: "no_buy_fill_found" };

  const px = Number(buy?.price || buy?.fill_price || 0);
  const qty = Number(buy?.size || buy?.filled_size || buy?.base_size || 0);
  const t = String(buy?.trade_time || buy?.created_time || buy?.time || "");

  if (!Number.isFinite(px) || px <= 0) return { ok: false, error: { bad_price: buy } };

  return { ok: true, entryPrice: px, entryTime: t || nowIso(), entryQty: qty };
}

// ---------- peak price via candles ----------
async function fetchPeakWindow(): Promise<
  | { ok: true; peak: number; last: number; startTs: string; endTs: string }
  | { ok: false; error: any }
> {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 3600 * 1000);

  const startTs = String(Math.floor(start.getTime() / 1000));
  const endTs = String(Math.floor(end.getTime() / 1000));

  const gran = optEnv("PULSE_CANDLE_GRANULARITY") || "ONE_MINUTE";
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    PRODUCT_ID
  )}/candles?start=${encodeURIComponent(startTs)}&end=${encodeURIComponent(
    endTs
  )}&granularity=${encodeURIComponent(gran)}`;

  const r = await cbFetch(path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const candles = (r.json as any)?.candles || [];
  if (!Array.isArray(candles) || candles.length === 0)
    return { ok: false, error: "no_candles" };

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

  return { ok: true, peak, last, startTs, endTs };
}

// ---------- call pulse-trade ----------
function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://yieldcraft.co").replace(
    /\/$/,
    ""
  );
}
function authHeadersForInternalCall() {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // pulse-trade doesn't require auth, but leaving header is fine
  if (cronSecret) headers["x-cron-secret"] = cronSecret;
  return headers;
}
async function callPulseTrade(payload: any) {
  const url = `${siteBaseUrl()}/api/pulse-trade`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersForInternalCall(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, data: safeJsonParse(text) ?? text };
}
async function placeSell(baseSize: string) {
  return callPulseTrade({ action: "place_order", side: "SELL", base_size: baseSize });
}
async function placeBuy(quoteSize: string) {
  return callPulseTrade({ action: "place_order", side: "BUY", quote_size: quoteSize });
}

// ---------- main runner (entries + exits) ----------
async function runManager() {
  const botEnabled = truthy(process.env.BOT_ENABLED);
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);

  const entriesEnabled = truthy(process.env.PULSE_ENTRIES_ENABLED);
  const entriesDryRun = truthy(process.env.PULSE_ENTRIES_DRY_RUN);

  const exitsEnabled = truthy(process.env.PULSE_EXITS_ENABLED);
  const exitsDryRun = truthy(process.env.PULSE_EXITS_DRY_RUN);

  const cooldownMs = num(process.env.COOLDOWN_MS, 60_000);

  // exits params
  const profitTargetBps = num(process.env.PROFIT_TARGET_BPS, 120);
  const trailArmBps = num(process.env.TRAIL_ARM_BPS, 150);
  const trailOffsetBps = num(process.env.TRAIL_OFFSET_BPS, 50);

  // entry size
  const entryQuoteUsd = fmtQuoteSizeUsd(num(process.env.PULSE_ENTRY_QUOTE_USD, 2.0));

  const position = await fetchBtcPosition();

  const gates = {
    BOT_ENABLED: botEnabled,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    PULSE_ENTRIES_ENABLED: entriesEnabled,
    PULSE_ENTRIES_DRY_RUN: entriesDryRun,
    PULSE_EXITS_ENABLED: exitsEnabled,
    PULSE_EXITS_DRY_RUN: exitsDryRun,
    LIVE_ALLOWED: botEnabled && tradingEnabled && armed,
  };

  if (!gates.LIVE_ALLOWED) return { ok: true, mode: "NOOP_GATES", gates, position };
  if (!position.ok) return { ok: false, mode: "BLOCKED", gates, error: "cannot_read_position", position };

  // ---- COOLDOWN: use last BUY fill time if available ----
  const lastBuy = await fetchLastBuyFill();
  const lastFillIso = lastBuy.ok ? lastBuy.entryTime : null;
  const sinceMs = msSince(lastFillIso);
  const cooldownOk = sinceMs >= cooldownMs;

  const cooldown = {
    lastFillIso,
    sinceMs: Number.isFinite(sinceMs) ? sinceMs : null,
    cooldownMs,
    cooldownOk,
  };

  // ---- ENTRY: if no position and entries enabled ----
  if (!position.has_position) {
    if (!entriesEnabled) return { ok: true, mode: "NO_POSITION_ENTRIES_DISABLED", gates, position, cooldown };
    if (!cooldownOk) return { ok: true, mode: "NO_POSITION_COOLDOWN", gates, position, cooldown };

    if (entriesDryRun) {
      return {
        ok: true,
        mode: "DRY_RUN_BUY",
        gates,
        position,
        cooldown,
        would_buy_quote_usd: entryQuoteUsd,
      };
    }

    const buy = await placeBuy(entryQuoteUsd);
    return { ok: buy.ok, mode: "ENTRY_BUY", gates, position, cooldown, buy };
  }

  // ---- EXIT: if position exists ----
  if (!exitsEnabled) return { ok: true, mode: "HOLD_EXITS_DISABLED", gates, position, cooldown };

  // entry info for exits
  if (!lastBuy.ok) {
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "cannot_read_entry", lastBuy };
  }

  const peak = await fetchPeakWindow();
  if (!peak.ok) return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "cannot_read_peak", peak };

  const entryPrice = lastBuy.entryPrice;
  const current = peak.last;
  const peakPrice = peak.peak;

  const pnlBps = ((current - entryPrice) / entryPrice) * 10_000;
  const drawdownFromPeakBps = ((peakPrice - current) / peakPrice) * 10_000;

  const shouldTakeProfit = pnlBps >= profitTargetBps;
  const trailArmed = pnlBps >= trailArmBps;
  const shouldTrailStop = trailArmed && drawdownFromPeakBps >= trailOffsetBps;

  const decision = {
    entryPrice,
    entryTime: lastBuy.entryTime,
    candleWindow: { startTs: peak.startTs, endTs: peak.endTs },
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
    return { ok: true, mode: "HOLD", gates, position, cooldown, decision };
  }

  const baseSize = fmtBaseSize(position.base_available);

  if (exitsDryRun) {
    return { ok: true, mode: "DRY_RUN_SELL", gates, position, cooldown, decision, would_sell_base_size: baseSize };
  }

  const sell = await placeSell(baseSize);
  return { ok: sell.ok, mode: "EXIT_SELL", gates, position, cooldown, decision, sell };
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
      PULSE_ENTRIES_ENABLED: truthy(process.env.PULSE_ENTRIES_ENABLED),
      PULSE_ENTRIES_DRY_RUN: truthy(process.env.PULSE_ENTRIES_DRY_RUN),
      PULSE_EXITS_ENABLED: truthy(process.env.PULSE_EXITS_ENABLED),
      PULSE_EXITS_DRY_RUN: truthy(process.env.PULSE_EXITS_DRY_RUN),
      LIVE_ALLOWED:
        truthy(process.env.BOT_ENABLED) &&
        truthy(process.env.COINBASE_TRADING_ENABLED) &&
        truthy(process.env.PULSE_TRADE_ARMED),
    };
    return json(200, { ok: true, status: "PULSE_MANAGER_READY", gates, position });
  }

  // default: run
  const result = await runManager();
  return json(result.ok ? 200 : 500, result);
}
