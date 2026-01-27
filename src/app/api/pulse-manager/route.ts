// src/app/api/pulse-manager/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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

// ---------- logging (safe) ----------
function log(runId: string, event: string, data?: any) {
  const payload = {
    t: new Date().toISOString(),
    runId,
    event,
    ...(data ? { data } : {}),
  };
  console.log("[pulse-manager]", JSON.stringify(payload));
}

// ---------- supabase (server-only) ----------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY"); // server-only
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * NOTE:
 * Your current public.trade_logs table (per your screenshot) has columns:
 *   order_id (text), raw (jsonb), size (numeric), mode (text)
 * So inserts MUST match that schema.
 */
async function writeTradeLog(row: any) {
  try {
    const client = sb();
    const { error } = await client.from("trade_logs").insert([row]);
    if (error) {
      console.log(
        "[pulse-manager]",
        JSON.stringify({
          t: nowIso(),
          event: "DB_WRITE_ERR",
          data: String((error as any)?.message || error),
        })
      );
    } else {
      console.log(
        "[pulse-manager]",
        JSON.stringify({ t: nowIso(), event: "DB_WRITE_OK" })
      );
    }
  } catch (e: any) {
    console.log(
      "[pulse-manager]",
      JSON.stringify({
        t: nowIso(),
        event: "DB_WRITE_EX",
        data: String(e?.message || e),
      })
    );
  }
}

// ---------- auth ----------
function okAuth(req: Request) {
  const secret = (
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();
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

  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

  return jwt.sign(
    { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri },
    privateKey as any,
    { algorithm: "ES256", header: { kid: apiKeyName, nonce } as any }
  );
}

async function cbGet(path: string) {
  const token = buildCdpJwt("GET", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

async function cbPost(path: string, payload: any) {
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
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

// ---------- position ----------
async function fetchBtcPosition() {
  const r = await cbGet("/api/v3/brokerage/accounts");

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

  const r = await cbGet(path);
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

  if (!Number.isFinite(px) || px <= 0)
    return { ok: false, error: { bad_price: buy } };

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

  const r = await cbGet(path);
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

// ---------- LIVE order placement (direct, safe) ----------
async function placeBuyMarket(quoteUsd: string) {
  const path = "/api/v3/brokerage/orders";
  const payload = {
    client_order_id: `yc_mgr_buy_${Date.now()}`,
    product_id: PRODUCT_ID,
    side: "BUY",
    order_configuration: { market_market_ioc: { quote_size: quoteUsd } },
  };
  return cbPost(path, payload);
}

async function placeSellMarket(baseSize: string) {
  const path = "/api/v3/brokerage/orders";
  const payload = {
    client_order_id: `yc_mgr_sell_${Date.now()}`,
    product_id: PRODUCT_ID,
    side: "SELL",
    order_configuration: { market_market_ioc: { base_size: baseSize } },
  };
  return cbPost(path, payload);
}

// ---------- main runner (entries + exits) ----------
async function runManager(runId: string) {
  const botEnabled = truthy(process.env.BOT_ENABLED);
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);

  const entriesEnabled = truthy(process.env.PULSE_ENTRIES_ENABLED);
  const entriesDryRun = truthy(process.env.PULSE_ENTRIES_DRY_RUN);

  const exitsEnabled = truthy(process.env.PULSE_EXITS_ENABLED);
  const exitsDryRun = truthy(process.env.PULSE_EXITS_DRY_RUN);

  const cooldownMs = num(process.env.COOLDOWN_MS, 60_000);

  // exits params (profit + trail) with Recon-owned fallbacks
  const profitTargetBps = num(
    process.env.YC_PROFIT_TARGET_BPS ?? process.env.PROFIT_TARGET_BPS,
    120
  );
  const trailArmBps = num(
    process.env.YC_TRAIL_ARM_BPS ?? process.env.TRAIL_ARM_BPS,
    150
  );
  const trailOffsetBps = num(
    process.env.YC_TRAIL_OFFSET_BPS ?? process.env.TRAIL_OFFSET_BPS,
    50
  );

  // Recon contract knobs (read-only; enforcement still via PULSE_* flags below)
  const ycDefaultHardStopBps = num(process.env.YC_DEFAULT_HARD_STOP_BPS, 0);
  const ycDefaultTimeStopMin = num(process.env.YC_DEFAULT_TIME_STOP_MIN, 0);
  const ycDailyMaxLossBps = num(process.env.YC_DAILY_MAX_LOSS_BPS, 0);
  const ycMonthlyMaxDdBps = num(process.env.YC_MONTHLY_MAX_DD_BPS, 0);
  const ycDefaultAllocationPct = num(process.env.YC_DEFAULT_ALLOCATION_PCT, 0);

  // NEW: protection exits (loss-side)
  const hardStopEnabled = truthy(process.env.PULSE_HARD_STOP_ENABLED);
  const hardStopLossBps = num(
    process.env.PULSE_HARD_STOP_LOSS_BPS,
    ycDefaultHardStopBps
  );

  const timeStopEnabled = truthy(process.env.PULSE_TIME_STOP_ENABLED);
  const maxHoldMinutes = num(
    process.env.PULSE_MAX_HOLD_MINUTES,
    ycDefaultTimeStopMin
  );
  const maxHoldMs = maxHoldMinutes > 0 ? maxHoldMinutes * 60_000 : 0;

  // entry size
  const entryQuoteUsd = fmtQuoteSizeUsd(
    num(process.env.PULSE_ENTRY_QUOTE_USD, 2.0)
  );

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

  log(runId, "START", {
    gates,
    position_ok: position.ok,
    has_position: position.ok ? position.has_position : null,
    base_available: position.ok ? position.base_available : null,
    min_pos: (position as any)?.min_pos ?? null,
    entryQuoteUsd,
    cooldownMs,
    profitTargetBps,
    trailArmBps,
    trailOffsetBps,
    hardStopEnabled,
    hardStopLossBps,
    timeStopEnabled,
    maxHoldMinutes,
    yc: {
      defaultAllocationPct: ycDefaultAllocationPct,
      defaultHardStopBps: ycDefaultHardStopBps,
      defaultTimeStopMin: ycDefaultTimeStopMin,
      dailyMaxLossBps: ycDailyMaxLossBps,
      monthlyMaxDdBps: ycMonthlyMaxDdBps,
    },
  });

  if (!gates.LIVE_ALLOWED) {
    log(runId, "DECISION", {
      mode: "NOOP_GATES",
      reason: "LIVE_ALLOWED=false",
      gates,
    });
    return { ok: true, mode: "NOOP_GATES", gates, position };
  }

  if (!position.ok) {
    log(runId, "DECISION", {
      mode: "BLOCKED",
      reason: "cannot_read_position",
      status: (position as any)?.status,
    });
    return {
      ok: false,
      mode: "BLOCKED",
      gates,
      error: "cannot_read_position",
      position,
    };
  }

  // ---- COOLDOWN ----
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

  log(runId, "COOLDOWN", {
    lastBuy_ok: lastBuy.ok,
    lastFillIso,
    sinceMs: Number.isFinite(sinceMs) ? sinceMs : null,
    cooldownMs,
    cooldownOk,
  });

  // ---- ENTRY ----
  if (!position.has_position) {
    if (!entriesEnabled) {
      log(runId, "DECISION", {
        mode: "NO_POSITION_ENTRIES_DISABLED",
        reason: "entries disabled",
      });
      return {
        ok: true,
        mode: "NO_POSITION_ENTRIES_DISABLED",
        gates,
        position,
        cooldown,
      };
    }
    if (!cooldownOk) {
      log(runId, "DECISION", {
        mode: "NO_POSITION_COOLDOWN",
        reason: "cooldown active",
        cooldown,
      });
      return { ok: true, mode: "NO_POSITION_COOLDOWN", gates, position, cooldown };
    }

    if (entriesDryRun) {
      log(runId, "DECISION", {
        mode: "DRY_RUN_BUY",
        would_buy_quote_usd: entryQuoteUsd,
      });
      return {
        ok: true,
        mode: "DRY_RUN_BUY",
        gates,
        position,
        cooldown,
        would_buy_quote_usd: entryQuoteUsd,
      };
    }

    log(runId, "ACTION", { mode: "ENTRY_BUY", quote_usd: entryQuoteUsd });
    const buy = await placeBuyMarket(entryQuoteUsd);
    log(runId, "RESULT", {
      mode: "ENTRY_BUY",
      buy_ok: buy.ok,
      status: buy.status,
    });

    // ✅ FIX: match public.trade_logs schema: order_id, raw, size, mode
    await writeTradeLog({
      order_id: String(
        (buy.json as any)?.order_id ||
          (buy.json as any)?.order?.order_id ||
          (buy.json as any)?.id ||
          `yc_mgr_buy_${runId}`
      ),
      mode: "ENTRY_BUY",
      size: Number(entryQuoteUsd), // USD quote size for buy
      raw: buy.json ?? { text: buy.text ?? null, status: buy.status, ok: buy.ok },
    });

    return { ok: buy.ok, mode: "ENTRY_BUY", gates, position, cooldown, buy };
  }

  // ---- EXIT ----
  if (!exitsEnabled) {
    log(runId, "DECISION", {
      mode: "HOLD_EXITS_DISABLED",
      reason: "exits disabled",
    });
    return { ok: true, mode: "HOLD_EXITS_DISABLED", gates, position, cooldown };
  }

  if (!lastBuy.ok) {
    log(runId, "DECISION", {
      mode: "BLOCKED",
      reason: "cannot_read_entry",
      error: lastBuy.error,
    });
    return {
      ok: false,
      mode: "BLOCKED",
      gates,
      position,
      cooldown,
      error: "cannot_read_entry",
      lastBuy,
    };
  }

  const peak = await fetchPeakWindow();
  if (!peak.ok) {
    log(runId, "DECISION", {
      mode: "BLOCKED",
      reason: "cannot_read_peak",
      error: peak.error,
    });
    return {
      ok: false,
      mode: "BLOCKED",
      gates,
      position,
      cooldown,
      error: "cannot_read_peak",
      peak,
    };
  }

  const entryPrice = lastBuy.entryPrice;
  const current = peak.last;
  const peakPrice = peak.peak;

  const pnlBpsRaw = ((current - entryPrice) / entryPrice) * 10_000;
  const pnlBps = Number(pnlBpsRaw.toFixed(2));

  const drawdownFromPeakBpsRaw = ((peakPrice - current) / peakPrice) * 10_000;
  const drawdownFromPeakBps = Number(drawdownFromPeakBpsRaw.toFixed(2));

  const heldMs = msSince(lastBuy.entryTime);

  const shouldTakeProfit = pnlBps >= profitTargetBps;
  const trailArmed = pnlBps >= trailArmBps;
  const shouldTrailStop = trailArmed && drawdownFromPeakBps >= trailOffsetBps;

  const shouldHardStop =
    hardStopEnabled &&
    hardStopLossBps > 0 &&
    pnlBps <= -Math.abs(hardStopLossBps);

  const shouldTimeStop =
    timeStopEnabled &&
    maxHoldMs > 0 &&
    Number.isFinite(heldMs) &&
    heldMs >= maxHoldMs &&
    pnlBps < 0;

  const decision = {
    entryPrice,
    entryTime: lastBuy.entryTime,
    entryQty: Number.isFinite(lastBuy.entryQty) ? lastBuy.entryQty : null,
    heldMs: Number.isFinite(heldMs) ? heldMs : null,
    candleWindow: { startTs: peak.startTs, endTs: peak.endTs },
    current,
    peakPrice,
    pnlBps,
    drawdownFromPeakBps,
    profitTargetBps,
    trailArmBps,
    trailOffsetBps,
    shouldTakeProfit,
    trailArmed,
    shouldTrailStop,
    hardStopEnabled,
    hardStopLossBps,
    shouldHardStop,
    timeStopEnabled,
    maxHoldMinutes,
    shouldTimeStop,
    yc: {
      defaultAllocationPct: ycDefaultAllocationPct,
      dailyMaxLossBps: ycDailyMaxLossBps,
      monthlyMaxDdBps: ycMonthlyMaxDdBps,
    },
  };

  if (
    !shouldHardStop &&
    !shouldTimeStop &&
    !shouldTakeProfit &&
    !shouldTrailStop
  ) {
    log(runId, "DECISION", {
      mode: "HOLD",
      reason: "exit conditions not met",
      decision: {
        pnlBps,
        drawdownFromPeakBps,
        shouldHardStop,
        shouldTimeStop,
        shouldTakeProfit,
        trailArmed,
        shouldTrailStop,
      },
    });
    return { ok: true, mode: "HOLD", gates, position, cooldown, decision };
  }

  const baseSize = fmtBaseSize(position.base_available);

  if (exitsDryRun) {
    log(runId, "DECISION", {
      mode: "DRY_RUN_SELL",
      would_sell_base_size: baseSize,
      decision,
    });
    return {
      ok: true,
      mode: "DRY_RUN_SELL",
      gates,
      position,
      cooldown,
      decision,
      would_sell_base_size: baseSize,
    };
  }

  const reason = shouldHardStop
    ? "hard_stop"
    : shouldTimeStop
    ? "time_stop"
    : shouldTakeProfit
    ? "take_profit"
    : "trail_stop";

  log(runId, "ACTION", {
    mode: "EXIT_SELL",
    baseSize,
    reason,
    decision: {
      pnlBps,
      drawdownFromPeakBps,
      shouldHardStop,
      shouldTimeStop,
      shouldTakeProfit,
      shouldTrailStop,
    },
  });

  const sell = await placeSellMarket(baseSize);
  log(runId, "RESULT", {
    mode: "EXIT_SELL",
    sell_ok: sell.ok,
    status: sell.status,
  });

  // ✅ FIX: match public.trade_logs schema: order_id, raw, size, mode
  await writeTradeLog({
    order_id: String(
      (sell.json as any)?.order_id ||
        (sell.json as any)?.order?.order_id ||
        (sell.json as any)?.id ||
        `yc_mgr_sell_${runId}`
    ),
    mode: `EXIT_SELL:${reason}`,
    size: Number(baseSize), // BTC base size for sell
    raw:
      sell.json ??
      ({
        text: sell.text ?? null,
        status: sell.status,
        ok: sell.ok,
        reason,
      } as any),
  });

  return { ok: sell.ok, mode: "EXIT_SELL", gates, position, cooldown, decision, sell };
}

// ---------- handlers ----------
export async function GET(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const runId = (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : crypto.randomBytes(8).toString("hex");
  log(runId, "REQUEST", { method: "GET", url: req.url });

  const result = await runManager(runId);
  log(runId, "END", { ok: result.ok, mode: (result as any)?.mode });

  return json(result.ok ? 200 : 500, { runId, ...result });
}

export async function POST(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const runId = (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : crypto.randomBytes(8).toString("hex");
  log(runId, "REQUEST", { method: "POST", url: req.url });

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

    log(runId, "STATUS", {
      gates,
      position_ok: position.ok,
      has_position: position.ok ? position.has_position : null,
      base_available: position.ok ? position.base_available : null,
      min_pos: (position as any)?.min_pos ?? null,
    });

    return json(200, {
      ok: true,
      runId,
      status: "PULSE_MANAGER_READY",
      gates,
      position,
    });
  }

  const result = await runManager(runId);
  log(runId, "END", { ok: result.ok, mode: (result as any)?.mode });

  return json(result.ok ? 200 : 500, { runId, ...result });
}
