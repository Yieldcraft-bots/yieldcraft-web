// src/app/api/pulse-manager/route.ts
import { NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
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
function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}
function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
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
function fmtPriceUsd(x: number) {
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
async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
function shortKeyName(s: string) {
  if (!s) return "";
  const last = s.slice(-6);
  return `…${last}`;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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

// Always-print, greppable decision line (verifiable)
function exitDecisionLog(runId: string, decision: any) {
  console.log(
    "[pulse-manager]",
    `EXIT_DECISION ${runId} ${JSON.stringify(decision)}`
  );
}

// ---------- supabase (server-only) ----------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY"); // server-only
  return createClient(url, key, { auth: { persistSession: false } });
}

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

// ---------- Multi-user key source ----------
type KeyRow = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
};

function looksValidKeyRow(r: any): r is KeyRow {
  return !!(
    cleanString(r?.user_id) &&
    cleanString(r?.api_key_name).startsWith("organizations/") &&
    cleanString(r?.private_key).includes("BEGIN")
  );
}


async function loadAllCoinbaseKeys(): Promise<
  { ok: true; rows: KeyRow[] } | { ok: false; error: any }
> {
  try {
    const client = sb();

    // Prefer user_coinbase_keys if present, but keep legacy coinbase_keys too.
    const [qNew, qLegacy] = await Promise.all([
      client
        .from("user_coinbase_keys")
        .select("user_id, api_key_name, private_key, key_alg"),
      client
        .from("coinbase_keys")
        .select("user_id, api_key_name, private_key, key_alg"),
    ]);

    // If a table doesn't exist in a given project, Supabase returns an error.
    const newRows = qNew.error ? [] : (Array.isArray(qNew.data) ? qNew.data : []);
    const legacyRows = qLegacy.error
      ? []
      : (Array.isArray(qLegacy.data) ? qLegacy.data : []);

    const merged = [...newRows, ...legacyRows].filter(looksValidKeyRow);

    // Dedup by user_id, keep the first occurrence (new table rows come first)
    const seen = new Set<string>();
    const dedup: KeyRow[] = [];
    for (const r of merged) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      dedup.push({
        user_id: r.user_id,
        api_key_name: r.api_key_name,
        private_key: r.private_key,
        key_alg: r.key_alg ?? null,
      });
    }

    return { ok: true, rows: dedup };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ---------- Entitlements (risk cap) ----------
type EntRow = {
  user_id: string;
  pulse: boolean | null;
  recon: boolean | null;
  atlas: boolean | null;
  max_trade_size: number | null; // USD
  risk_mode: string | null;
};

async function fetchEntitlements(userId: string): Promise<
  { ok: true; ent: EntRow | null } | { ok: false; error: any }
> {
  try {
    const client = sb();
    const { data, error } = await client
      .from("entitlements")
      .select("user_id, pulse, recon, atlas, max_trade_size, risk_mode")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message || error };
    return { ok: true, ent: (data as any as EntRow) ?? null };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function effectiveMaxTradeUsd(ent: EntRow | null): number {
  // default to 10 if null/invalid
  const raw = Number(ent?.max_trade_size ?? NaN);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 10;
}

// ---------- Coinbase CDP JWT (per-user) ----------
type Ctx = {
  user_id: string;
  api_key_name: string;
  private_key: string;
  key_alg?: string | null;
};

function algFor(ctx: Ctx): "ES256" | "EdDSA" {
  const raw = (ctx.key_alg || "").toLowerCase();
  if (raw.includes("ed") || raw.includes("eddsa") || raw.includes("ed25519"))
    return "EdDSA";
  return "ES256";
}

function buildCdpJwt(ctx: Ctx, method: "GET" | "POST", path: string) {
  const apiKeyName = cleanString(ctx.api_key_name);
  const privateKeyPem = normalizePem(ctx.private_key);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

  const alg = algFor(ctx);
  const payload = { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri };

  const options: SignOptions = {
    algorithm: (alg === "EdDSA" ? "EdDSA" : "ES256") as any,
    header: { kid: apiKeyName, nonce } as any,
  };

  return jwt.sign(payload as any, privateKeyPem as any, options as any);
}

async function cbGet(ctx: Ctx, path: string) {
  const token = buildCdpJwt(ctx, "GET", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

async function cbPost(ctx: Ctx, path: string, payload: any) {
  const token = buildCdpJwt(ctx, "POST", path);
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

// ---------- price helpers ----------
async function fetchSpotPrice(
  ctx: Ctx
): Promise<{ ok: true; price: number } | { ok: false; error: any }> {
  const r = await cbGet(
    ctx,
    `/api/v3/brokerage/products/${encodeURIComponent(PRODUCT_ID)}`
  );
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const p =
    Number((r.json as any)?.price) ||
    Number((r.json as any)?.product?.price) ||
    Number((r.json as any)?.data?.price) ||
    0;

  if (!Number.isFinite(p) || p <= 0)
    return { ok: false, error: { bad_price: r.json } };
  return { ok: true, price: p };
}

// ---------- position ----------
async function fetchBtcPosition(ctx: Ctx) {
  const r = await cbGet(ctx, "/api/v3/brokerage/accounts");

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

// ---------- last BUY fill ----------
async function fetchLastBuyFill(
  ctx: Ctx
): Promise<
  | { ok: true; entryPrice: number; entryTime: string; entryQty: number }
  | { ok: false; error: any }
> {
  const path = `/api/v3/brokerage/orders/historical/fills?product_ids=${encodeURIComponent(
    PRODUCT_ID
  )}&limit=100&order_side=BUY&sort_by=TRADE_TIME`;

  const r = await cbGet(ctx, path);
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

// ---------- peak since entry (better trailing) ----------
async function fetchPeakSince(
  ctx: Ctx,
  entryIso: string,
  maxLookbackHours: number
): Promise<
  | { ok: true; peak: number; startTs: string; endTs: string; candles: number }
  | { ok: false; error: any }
> {
  const entryMs = Date.parse(entryIso);
  if (!Number.isFinite(entryMs)) return { ok: false, error: "bad_entry_time" };

  const end = new Date();
  const maxStart = new Date(end.getTime() - maxLookbackHours * 3600 * 1000);
  const start = new Date(Math.max(entryMs, maxStart.getTime()));

  const startTs = String(Math.floor(start.getTime() / 1000));
  const endTs = String(Math.floor(end.getTime() / 1000));

  const gran = optEnv("PULSE_CANDLE_GRANULARITY") || "ONE_MINUTE";
  const path = `/api/v3/brokerage/products/${encodeURIComponent(
    PRODUCT_ID
  )}/candles?start=${encodeURIComponent(startTs)}&end=${encodeURIComponent(
    endTs
  )}&granularity=${encodeURIComponent(gran)}`;

  const r = await cbGet(ctx, path);
  if (!r.ok) return { ok: false, error: r.json ?? r.text };

  const candles = (r.json as any)?.candles || [];
  if (!Array.isArray(candles) || candles.length === 0)
    return { ok: false, error: "no_candles" };

  let peak = 0;
  for (const c of candles) {
    const high = Number((c as any)?.high ?? (c as any)?.h ?? 0);
    if (Number.isFinite(high) && high > peak) peak = high;
  }

  if (!Number.isFinite(peak) || peak <= 0)
    return { ok: false, error: { bad_peak: candles[0] } };

  return { ok: true, peak, startTs, endTs, candles: candles.length };
}

// ---------- maker helpers ----------
function makerOffsetBps(): number {
  return num(process.env.MAKER_OFFSET_BPS, 1.0);
}
function makerTimeoutMs(): number {
  return num(process.env.MAKER_TIMEOUT_MS, 15000);
}
function makerAllowIocFallback(): boolean {
  return truthy(process.env.MAKER_ALLOW_IOC_FALLBACK);
}

async function fetchOrderStatus(ctx: Ctx, orderId: string) {
  const r = await cbGet(
    ctx,
    `/api/v3/brokerage/orders/historical/${encodeURIComponent(orderId)}`
  );
  if (!r.ok)
    return { ok: false as const, status: r.status, raw: r.json ?? r.text };

  const o = (r.json as any)?.order ?? (r.json as any);
  const status = String(o?.status || o?.order?.status || "").toUpperCase();
  const filled = Number(
    o?.filled_size || o?.filled_value || o?.filled_quantity || 0
  );
  const done = ["FILLED", "DONE", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED"].includes(
    status
  );

  return { ok: true as const, status, filled, done, raw: r.json };
}

async function placeLimitPostOnly(
  ctx: Ctx,
  side: "BUY" | "SELL",
  baseSize: string,
  limitPrice: string
) {
  const path = "/api/v3/brokerage/orders";
  const payload = {
    client_order_id: `yc_mgr_${ctx.user_id}_${side.toLowerCase()}_maker_${Date.now()}`,
    product_id: PRODUCT_ID,
    side,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        post_only: true,
      },
    },
  };
  return cbPost(ctx, path, payload);
}

async function placeMarketIoc(
  ctx: Ctx,
  side: "BUY" | "SELL",
  quoteUsd?: string,
  baseSize?: string
) {
  const path = "/api/v3/brokerage/orders";
  const payload =
    side === "BUY"
      ? {
          client_order_id: `yc_mgr_${ctx.user_id}_buy_ioc_${Date.now()}`,
          product_id: PRODUCT_ID,
          side: "BUY",
          order_configuration: { market_market_ioc: { quote_size: quoteUsd } },
        }
      : {
          client_order_id: `yc_mgr_${ctx.user_id}_sell_ioc_${Date.now()}`,
          product_id: PRODUCT_ID,
          side: "SELL",
          order_configuration: { market_market_ioc: { base_size: baseSize } },
        };
  return cbPost(ctx, path, payload);
}

async function makerFirstBuy(ctx: Ctx, quoteUsd: string, refPrice: number) {
  const offset = makerOffsetBps();
  const limitPx = refPrice * (1 - offset / 10_000);
  const base = Number(quoteUsd) / refPrice;
  const baseSize = fmtBaseSize(base);
  const limitPrice = fmtPriceUsd(limitPx);

  const maker = await placeLimitPostOnly(ctx, "BUY", baseSize, limitPrice);
  return { maker, baseSize, limitPrice, refPrice };
}

async function makerFirstSell(ctx: Ctx, baseSize: string, refPrice: number) {
  const offset = makerOffsetBps();
  const limitPx = refPrice * (1 + offset / 10_000);
  const limitPrice = fmtPriceUsd(limitPx);

  const maker = await placeLimitPostOnly(ctx, "SELL", baseSize, limitPrice);
  return { maker, limitPrice, refPrice };
}

function extractOrderId(respJson: any): string | null {
  const j = respJson || {};
  return (
    j?.order_id ||
    j?.success_response?.order_id ||
    j?.order?.order_id ||
    j?.order?.id ||
    j?.id ||
    null
  );
}

// ---------- core runner per-user ----------
async function runManagerForUser(runId: string, ctx: Ctx) {
  const botEnabled = truthy(process.env.BOT_ENABLED);
  const tradingEnabled = truthy(process.env.COINBASE_TRADING_ENABLED);
  const armed = truthy(process.env.PULSE_TRADE_ARMED);

  const entriesEnabled = truthy(process.env.PULSE_ENTRIES_ENABLED);
  const entriesDryRun = truthy(process.env.PULSE_ENTRIES_DRY_RUN);

  const exitsEnabled = truthy(process.env.PULSE_EXITS_ENABLED);
  const exitsDryRun = truthy(process.env.PULSE_EXITS_DRY_RUN);

  const cooldownMs = num(process.env.COOLDOWN_MS, 60_000);

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

  const ycDefaultHardStopBps = num(process.env.YC_DEFAULT_HARD_STOP_BPS, 0);
  const ycDefaultTimeStopMin = num(process.env.YC_DEFAULT_TIME_STOP_MIN, 0);

  const hardStopEnabled = truthy(process.env.PULSE_HARD_STOP_ENABLED);
  const hardStopLossBps = num(process.env.PULSE_HARD_STOP_LOSS_BPS, ycDefaultHardStopBps);

  const timeStopEnabled = truthy(process.env.PULSE_TIME_STOP_ENABLED);
  const maxHoldMinutes = num(process.env.PULSE_MAX_HOLD_MINUTES, ycDefaultTimeStopMin);
  const maxHoldMs = maxHoldMinutes > 0 ? maxHoldMinutes * 60_000 : 0;

  // Base entry size (will be capped by entitlements.max_trade_size)
  const rawEntryUsd = num(process.env.PULSE_ENTRY_QUOTE_USD, 2.0);

  // FIX: honor MAKER_MODE=false
  const makerMode =
    process.env.MAKER_MODE == null ? true : truthy(process.env.MAKER_MODE);

  const mOffset = makerOffsetBps();
  const mTimeout = makerTimeoutMs();
  const mAllowIoc = makerAllowIocFallback();

  // Entitlements: enforce plan + max_trade_size
  const entR = await fetchEntitlements(ctx.user_id);
  const ent = entR.ok ? entR.ent : null;

  const pulseAllowed = !!ent?.pulse; // require pulse entitlement true to run
  const maxTradeUsd = effectiveMaxTradeUsd(ent);

  const position = await fetchBtcPosition(ctx);

  const gates = {
    BOT_ENABLED: botEnabled,
    COINBASE_TRADING_ENABLED: tradingEnabled,
    PULSE_TRADE_ARMED: armed,
    PULSE_ENTRIES_ENABLED: entriesEnabled,
    PULSE_ENTRIES_DRY_RUN: entriesDryRun,
    PULSE_EXITS_ENABLED: exitsEnabled,
    PULSE_EXITS_DRY_RUN: exitsDryRun,
    PULSE_ENTITLED: pulseAllowed,
    LIVE_ALLOWED: botEnabled && tradingEnabled && armed && pulseAllowed,
  };

  log(runId, "START", {
    user_id: ctx.user_id,
    key: shortKeyName(ctx.api_key_name),
    alg: algFor(ctx),
    gates,
    ent: entR.ok
      ? {
          pulse: ent?.pulse ?? null,
          recon: ent?.recon ?? null,
          atlas: ent?.atlas ?? null,
          max_trade_size: maxTradeUsd,
          risk_mode: ent?.risk_mode ?? null,
        }
      : { error: entR.error },
    position_ok: (position as any)?.ok,
    has_position: (position as any)?.ok ? (position as any).has_position : null,
    base_available: (position as any)?.ok ? (position as any).base_available : null,
    min_pos: (position as any)?.min_pos ?? null,
    cooldownMs,
    profitTargetBps,
    trailArmBps,
    trailOffsetBps,
    hardStopEnabled,
    hardStopLossBps,
    timeStopEnabled,
    maxHoldMinutes,
    maker: { makerMode, mOffset, mTimeout, mAllowIoc },
  });

  if (!gates.LIVE_ALLOWED) {
    return { ok: true, mode: "NOOP_GATES", gates, position };
  }

  if (!(position as any)?.ok) {
    return {
      ok: false,
      mode: "BLOCKED",
      gates,
      error: "cannot_read_position",
      position,
    };
  }

  // ---- COOLDOWN ----
  const lastBuy = await fetchLastBuyFill(ctx);
  const lastFillIso = lastBuy.ok ? lastBuy.entryTime : null;
  const sinceMs = msSince(lastFillIso);
  const cooldownOk = sinceMs >= cooldownMs;

  const cooldown = {
    lastFillIso,
    sinceMs: Number.isFinite(sinceMs) ? sinceMs : null,
    cooldownMs,
    cooldownOk,
  };

  // ---- live spot price (use for current + sizing) ----
  const spot = await fetchSpotPrice(ctx);
  const currentSpot = spot.ok ? spot.price : 0;

  // ---- ENTRY ----
  if (!(position as any).has_position) {
    if (!entriesEnabled) {
      return { ok: true, mode: "NO_POSITION_ENTRIES_DISABLED", gates, position, cooldown };
    }
    if (!cooldownOk) {
      return { ok: true, mode: "NO_POSITION_COOLDOWN", gates, position, cooldown };
    }

    // Enforce max_trade_size (USD) for everyone
    const entryUsd = clamp(rawEntryUsd, 0.01, maxTradeUsd);
    const entryQuoteUsd = fmtQuoteSizeUsd(entryUsd);

    if (entriesDryRun) {
      return {
        ok: true,
        mode: "DRY_RUN_BUY",
        gates,
        position,
        cooldown,
        maxTradeUsd,
        would_buy_quote_usd: entryQuoteUsd,
      };
    }

    // Need a reference price for maker (use spot if available)
    const refPrice = currentSpot > 0 ? currentSpot : 0;

    if (!makerMode || !refPrice) {
      if (!mAllowIoc) {
        return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "no_ref_price" };
      }

      const buy = await placeMarketIoc(ctx, "BUY", entryQuoteUsd);
      await writeTradeLog({
        t: nowIso(),
        run_id: runId,
        product_id: PRODUCT_ID,
        side: "BUY",
        mode: "ENTRY_BUY_IOC",
        ok: buy.ok,
        status: buy.status,
        user_id: ctx.user_id,
        raw: buy.json ?? buy.text ?? null,
        maxTradeUsd,
        entryQuoteUsd,
      });

      return { ok: buy.ok, mode: "ENTRY_BUY_IOC", gates, position, cooldown, buy };
    }

    const attempt = await makerFirstBuy(ctx, entryQuoteUsd, refPrice);
    const makerOk = attempt.maker.ok;
    const makerJson = attempt.maker.json ?? null;
    const makerOrderId = extractOrderId(makerJson);

    if (!makerOk || !makerOrderId) {
      if (!mAllowIoc) {
        await writeTradeLog({
          t: nowIso(),
          run_id: runId,
          product_id: PRODUCT_ID,
          side: "BUY",
          mode: "ENTRY_BUY_MAKER_FAILED",
          ok: false,
          status: attempt.maker.status,
          user_id: ctx.user_id,
          raw: attempt.maker.json ?? attempt.maker.text ?? null,
          maxTradeUsd,
          entryQuoteUsd,
        });
        return {
          ok: false,
          mode: "ENTRY_BUY_MAKER_FAILED",
          gates,
          position,
          cooldown,
          error: "maker_order_failed",
          maker: attempt.maker,
        };
      }

      const buy = await placeMarketIoc(ctx, "BUY", entryQuoteUsd);
      await writeTradeLog({
        t: nowIso(),
        run_id: runId,
        product_id: PRODUCT_ID,
        side: "BUY",
        mode: "ENTRY_BUY_IOC_FALLBACK",
        ok: buy.ok,
        status: buy.status,
        user_id: ctx.user_id,
        raw: buy.json ?? buy.text ?? null,
        maxTradeUsd,
        entryQuoteUsd,
      });

      return { ok: buy.ok, mode: "ENTRY_BUY_IOC_FALLBACK", gates, position, cooldown, buy };
    }

    // poll maker order for fill
    const deadline = Date.now() + mTimeout;
    let lastStatus: any = null;

    while (Date.now() < deadline) {
      const st = await fetchOrderStatus(ctx, makerOrderId);
      lastStatus = st;
      if (st.ok) {
        if ((st.filled ?? 0) > 0 || st.done) break;
      } else {
        break;
      }
      await sleep(1200);
    }

    const filled = lastStatus?.ok ? Number(lastStatus.filled || 0) : 0;
    const done = lastStatus?.ok ? !!lastStatus.done : false;

    if (filled > 0 || done) {
      await writeTradeLog({
        t: nowIso(),
        run_id: runId,
        product_id: PRODUCT_ID,
        side: "BUY",
        mode: "ENTRY_BUY_MAKER",
        ok: true,
        status: attempt.maker.status,
        user_id: ctx.user_id,
        raw: { maker: attempt.maker.json ?? attempt.maker.text ?? null, status: lastStatus },
        maxTradeUsd,
        entryQuoteUsd,
      });

      return {
        ok: true,
        mode: "ENTRY_BUY_MAKER",
        gates,
        position,
        cooldown,
        maker_order_id: makerOrderId,
        maker_status: lastStatus,
      };
    }

    if (!mAllowIoc) {
      await writeTradeLog({
        t: nowIso(),
        run_id: runId,
        product_id: PRODUCT_ID,
        side: "BUY",
        mode: "ENTRY_BUY_MAKER_TIMEOUT",
        ok: true,
        status: attempt.maker.status,
        user_id: ctx.user_id,
        raw: { maker: attempt.maker.json ?? attempt.maker.text ?? null, status: lastStatus },
        maxTradeUsd,
        entryQuoteUsd,
      });

      return {
        ok: true,
        mode: "ENTRY_BUY_MAKER_TIMEOUT",
        gates,
        position,
        cooldown,
        maker_order_id: makerOrderId,
        maker_status: lastStatus,
      };
    }

    const buy = await placeMarketIoc(ctx, "BUY", entryQuoteUsd);
    await writeTradeLog({
      t: nowIso(),
      run_id: runId,
      product_id: PRODUCT_ID,
      side: "BUY",
      mode: "ENTRY_BUY_IOC_AFTER_TIMEOUT",
      ok: buy.ok,
      status: buy.status,
      user_id: ctx.user_id,
      raw: buy.json ?? buy.text ?? null,
      maxTradeUsd,
      entryQuoteUsd,
    });

    return { ok: buy.ok, mode: "ENTRY_BUY_IOC_AFTER_TIMEOUT", gates, position, cooldown, buy };
  }

  // ---- EXIT ----
  if (!exitsEnabled) {
    return { ok: true, mode: "HOLD_EXITS_DISABLED", gates, position, cooldown };
  }

  if (!lastBuy.ok) {
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "cannot_read_entry", lastBuy };
  }

  // Use live spot as "current"
  const current = currentSpot > 0 ? currentSpot : 0;
  if (!Number.isFinite(current) || current <= 0) {
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "cannot_read_current_spot", spot };
  }

  // Compute peak since entry (cap lookback to avoid huge candle pulls)
  const peakLookbackHours = clamp(num(process.env.PULSE_PEAK_LOOKBACK_HOURS, 24), 2, 168);
  const peak = await fetchPeakSince(ctx, lastBuy.entryTime, peakLookbackHours);
  if (!peak.ok) {
    return { ok: false, mode: "BLOCKED", gates, position, cooldown, error: "cannot_read_peak_since_entry", peak };
  }

  const entryPrice = lastBuy.entryPrice;
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
    hardStopEnabled && hardStopLossBps > 0 && pnlBps <= -Math.abs(hardStopLossBps);

  const shouldTimeStop =
    timeStopEnabled &&
    maxHoldMs > 0 &&
    Number.isFinite(heldMs) &&
    heldMs >= maxHoldMs &&
    pnlBps < 0;

  const baseAvail = Number((position as any).base_available || 0);
  const posUsd = Number.isFinite(baseAvail) ? baseAvail * current : null;

  const decision = {
    entryPrice,
    entryTime: lastBuy.entryTime,
    entryQty: Number.isFinite(lastBuy.entryQty) ? lastBuy.entryQty : null,
    heldMs: Number.isFinite(heldMs) ? heldMs : null,
    current,
    peakPrice,
    peakWindow: { startTs: peak.startTs, endTs: peak.endTs, candles: peak.candles, lookbackHours: peakLookbackHours },
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
    position: { baseAvail, posUsd, maxTradeUsd },
    maker: { makerMode, mOffset, mTimeout, mAllowIoc },
  };

  // REQUIRED verifiable line every cycle
  exitDecisionLog(runId, decision);

  if (!shouldHardStop && !shouldTimeStop && !shouldTakeProfit && !shouldTrailStop) {
    return { ok: true, mode: "HOLD", gates, position, cooldown, decision };
  }

  const baseSize = fmtBaseSize(baseAvail);

  if (exitsDryRun) {
    return { ok: true, mode: "DRY_RUN_SELL", gates, position, cooldown, decision, would_sell_base_size: baseSize };
  }

  const reason =
    shouldHardStop ? "hard_stop" :
    shouldTimeStop ? "time_stop" :
    shouldTakeProfit ? "take_profit" :
    "trail_stop";

  // Use live current for exit reference
  const exitRef = current;

  if (!makerMode || !Number.isFinite(exitRef) || exitRef <= 0) {
    if (!mAllowIoc) {
      return { ok: false, mode: "BLOCKED", gates, position, cooldown, decision, error: "no_ref_price_for_exit" };
    }

    const sell = await placeMarketIoc(ctx, "SELL", undefined, baseSize);
    await writeTradeLog({
      t: nowIso(),
      run_id: runId,
      product_id: PRODUCT_ID,
      side: "SELL",
      mode: "EXIT_SELL_IOC",
      ok: sell.ok,
      status: sell.status,
      user_id: ctx.user_id,
      raw: sell.json ?? sell.text ?? null,
      reason,
      decision,
    });

    return { ok: sell.ok, mode: "EXIT_SELL_IOC", gates, position, cooldown, decision, sell, reason };
  }

  const attempt = await makerFirstSell(ctx, baseSize, exitRef);
  const makerOk = attempt.maker.ok;
  const makerJson = attempt.maker.json ?? null;
  const makerOrderId = extractOrderId(makerJson);

  if (!makerOk || !makerOrderId) {
    if (!mAllowIoc) {
      await writeTradeLog({
        t: nowIso(),
        run_id: runId,
        product_id: PRODUCT_ID,
        side: "SELL",
        mode: "EXIT_SELL_MAKER_FAILED",
        ok: false,
        status: attempt.maker.status,
        user_id: ctx.user_id,
        raw: attempt.maker.json ?? attempt.maker.text ?? null,
        reason,
        decision,
      });

      return {
        ok: false,
        mode: "EXIT_SELL_MAKER_FAILED",
        gates,
        position,
        cooldown,
        decision,
        reason,
        error: "maker_exit_failed",
        maker: attempt.maker,
      };
    }

    const sell = await placeMarketIoc(ctx, "SELL", undefined, baseSize);
    await writeTradeLog({
      t: nowIso(),
      run_id: runId,
      product_id: PRODUCT_ID,
      side: "SELL",
      mode: "EXIT_SELL_IOC_FALLBACK",
      ok: sell.ok,
      status: sell.status,
      user_id: ctx.user_id,
      raw: sell.json ?? sell.text ?? null,
      reason,
      decision,
    });

    return { ok: sell.ok, mode: "EXIT_SELL_IOC_FALLBACK", gates, position, cooldown, decision, sell, reason };
  }

  const deadline = Date.now() + mTimeout;
  let lastStatus: any = null;

  while (Date.now() < deadline) {
    const st = await fetchOrderStatus(ctx, makerOrderId);
    lastStatus = st;
    if (st.ok) {
      if ((st.filled ?? 0) > 0 || st.done) break;
    } else {
      break;
    }
    await sleep(1200);
  }

  const filled = lastStatus?.ok ? Number(lastStatus.filled || 0) : 0;
  const done = lastStatus?.ok ? !!lastStatus.done : false;

  if (filled > 0 || done) {
    await writeTradeLog({
      t: nowIso(),
      run_id: runId,
      product_id: PRODUCT_ID,
      side: "SELL",
      mode: "EXIT_SELL_MAKER",
      ok: true,
      status: attempt.maker.status,
      user_id: ctx.user_id,
      raw: { maker: attempt.maker.json ?? attempt.maker.text ?? null, status: lastStatus },
      reason,
      decision,
    });

    return {
      ok: true,
      mode: "EXIT_SELL_MAKER",
      gates,
      position,
      cooldown,
      decision,
      reason,
      maker_order_id: makerOrderId,
      maker_status: lastStatus,
    };
  }

  if (!mAllowIoc) {
    await writeTradeLog({
      t: nowIso(),
      run_id: runId,
      product_id: PRODUCT_ID,
      side: "SELL",
      mode: "EXIT_SELL_MAKER_TIMEOUT",
      ok: true,
      status: attempt.maker.status,
      user_id: ctx.user_id,
      raw: { maker: attempt.maker.json ?? attempt.maker.text ?? null, status: lastStatus },
      reason,
      decision,
    });

    return {
      ok: true,
      mode: "EXIT_SELL_MAKER_TIMEOUT",
      gates,
      position,
      cooldown,
      decision,
      reason,
      maker_order_id: makerOrderId,
      maker_status: lastStatus,
    };
  }

  const sell = await placeMarketIoc(ctx, "SELL", undefined, baseSize);
  await writeTradeLog({
    t: nowIso(),
    run_id: runId,
    product_id: PRODUCT_ID,
    side: "SELL",
    mode: "EXIT_SELL_IOC_AFTER_TIMEOUT",
    ok: sell.ok,
    status: sell.status,
    user_id: ctx.user_id,
    raw: sell.json ?? sell.text ?? null,
    reason,
    decision,
  });

  return { ok: sell.ok, mode: "EXIT_SELL_IOC_AFTER_TIMEOUT", gates, position, cooldown, decision, sell, reason };
}

// ---------- multi-user orchestrator ----------
async function runForAllUsers(masterRunId: string) {
  const loaded = await loadAllCoinbaseKeys();
  if (!loaded.ok) {
    return { ok: false, error: "cannot_load_users", details: loaded.error };
  }

  const rows = loaded.rows;

  if (rows.length === 0) {
    return { ok: true, usersProcessed: 0, results: [], note: "no coinbase key rows found" };
  }

  const results: any[] = [];
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const runId = `${masterRunId}:${i + 1}`;
    const ctx: Ctx = {
      user_id: r.user_id,
      api_key_name: r.api_key_name,
      private_key: r.private_key,
      key_alg: r.key_alg ?? null,
    };

    try {
      const out = await runManagerForUser(runId, ctx);
      if ((out as any)?.ok) okCount++;
      else failCount++;

      results.push({
        runId,
        user_id: ctx.user_id,
        key: shortKeyName(ctx.api_key_name),
        alg: algFor(ctx),
        ok: !!(out as any)?.ok,
        mode: (out as any)?.mode,
        gates: (out as any)?.gates,
        position: (out as any)?.position,
        cooldown: (out as any)?.cooldown,
        decision: (out as any)?.decision,
        reason: (out as any)?.reason,
        error: (out as any)?.error,
        status: (out as any)?.status,
      });
    } catch (e: any) {
      failCount++;
      results.push({
        runId,
        user_id: ctx.user_id,
        key: shortKeyName(ctx.api_key_name),
        alg: algFor(ctx),
        ok: false,
        mode: "EXCEPTION",
        error: e?.message || String(e),
      });
    }
  }

  return {
    ok: failCount === 0,
    usersProcessed: rows.length,
    okCount,
    failCount,
    results,
  };
}

// ---------- handlers ----------
export async function GET(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const action = String(url.searchParams.get("action") || "run").toLowerCase();

  const masterRunId = (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : crypto.randomBytes(8).toString("hex");

  log(masterRunId, "REQUEST", { method: "GET", url: req.url, action });

  const result = await runForAllUsers(masterRunId);

  log(masterRunId, "END", {
    ok: (result as any).ok,
    usersProcessed: (result as any)?.usersProcessed,
  });

  return json((result as any).ok ? 200 : 500, { runId: masterRunId, action, ...result });
}

export async function POST(req: Request) {
  if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const masterRunId = (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : crypto.randomBytes(8).toString("hex");

  log(masterRunId, "REQUEST", { method: "POST", url: req.url });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const action = String(body?.action || "run").toLowerCase();

  const result = await runForAllUsers(masterRunId);

  log(masterRunId, "END", {
    ok: (result as any).ok,
    usersProcessed: (result as any)?.usersProcessed,
  });

  return json((result as any).ok ? 200 : 500, { runId: masterRunId, action, ...result });
}
