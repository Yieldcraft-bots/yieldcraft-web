// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}
function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function nowIso() {
  return new Date().toISOString();
}
function toIsoMaybe(x: any): string | null {
  const s = cleanString(x);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}
function shortId() {
  return crypto.randomBytes(6).toString("hex");
}
function asNumber(x: any): number | null {
  if (x == null) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object") {
    // Coinbase often uses { value: "0.12", currency: "USD" }
    const v = (x as any)?.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function firstNum(...vals: any[]): number | null {
  for (const v of vals) {
    const n = asNumber(v);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

// ---------- auth (admin-only) ----------
// Accepts: ?secret= , x-admin-secret , x-cron-secret , authorization: Bearer <secret>
function okAdminAuth(req: Request) {
  const secret = (
    process.env.ADMIN_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PULSE_MANAGER_SECRET ||
    ""
  ).trim();

  if (!secret) return false;

  const h =
    req.headers.get("x-admin-secret") ||
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization") ||
    "";

  if (h === secret || h === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

// ---------- supabase ----------
function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- types ----------
type TradeRow = {
  created_at?: string;
  t?: string;
  user_id?: string;
  bot?: string;
  symbol?: string;
  product_id?: string;
  side?: string;

  // sometimes present, often not
  order_id?: string;
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;

  maker_taker?: string | null;
  mode?: string | null;
  ok?: boolean | null;

  raw?: any; // jsonb
  decision?: any;
  reason?: string | null;
};

// ---------- parsing ----------
function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}

function pickSymbol(r: TradeRow): string {
  const raw = (r as any).raw || {};
  return (
    cleanString(r.symbol) ||
    cleanString(r.product_id) ||
    cleanString(raw?.success_response?.product_id) ||
    cleanString(raw?.order?.product_id) ||
    cleanString(raw?.response?.product_id) ||
    "UNKNOWN"
  );
}

function pickSide(r: TradeRow): "BUY" | "SELL" | null {
  const raw = (r as any).raw || {};
  const s = (
    cleanString(r.side) ||
    cleanString(raw?.success_response?.side) ||
    cleanString(raw?.order?.side) ||
    cleanString(raw?.response?.side)
  ).toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  return null;
}

function extractOrderId(r: TradeRow): string | null {
  const raw = (r as any).raw || {};
  return (
    cleanString(r.order_id) ||
    cleanString(raw?.success_response?.order_id) ||
    cleanString(raw?.order?.order_id) ||
    cleanString(raw?.order?.id) ||
    cleanString(raw?.response?.order_id) ||
    null
  );
}

/**
 * Extract fill-ish info from whatever we have.
 * Goal: return (price, base, quote, feeUsd) if possible.
 */
function extractFromRaw(r: TradeRow): {
  price: number | null;
  base: number | null;
  quote: number | null;
  feeUsd: number;
} {
  const raw = (r as any).raw || {};
  const resp = raw?.response ?? raw?.resp ?? raw;
  const ord = raw?.order ?? resp?.order ?? raw?.success_response ?? null;

  // Fills arrays show up in a few shapes
  const fills =
    raw?.fills ||
    resp?.fills ||
    resp?.order?.fills ||
    raw?.order?.fills ||
    raw?.fill ||
    null;

  // Normalize fills to array if possible
  const fillArr: any[] = Array.isArray(fills)
    ? fills
    : fills && Array.isArray(fills?.fills)
      ? fills.fills
      : [];

  // Sum base + quote from fills if present
  let baseFromFills = 0;
  let quoteFromFills = 0;
  let feeFromFills = 0;
  let pxFromFills: number | null = null;

  for (const f of fillArr) {
    const size = firstNum(
      f?.size,
      f?.filled_size,
      f?.base_size,
      f?.quantity,
      f?.amount
    );
    const price = firstNum(f?.price, f?.fill_price, f?.trade_price);
    const fee = firstNum(
      f?.commission,
      f?.fee,
      f?.fees,
      f?.total_fee,
      f?.total_fees,
      f?.commission_usd,
      f?.fee_usd
    );

    if (size != null && size > 0) baseFromFills += size;
    if (price != null && price > 0 && size != null && size > 0) {
      quoteFromFills += price * size;
      pxFromFills = pxFromFills ?? price;
    }

    if (fee != null && fee > 0) feeFromFills += fee;
  }

  // Order-level filled fields (common on historical order objects)
  const filledSize = firstNum(
    ord?.filled_size,
    ord?.total_filled_size,
    ord?.filled_base_size,
    ord?.filled_quantity,
    resp?.order?.filled_size,
    resp?.order?.total_filled_size
  );

  const filledValue = firstNum(
    ord?.filled_value,
    ord?.filled_quote_size,
    ord?.filled_usd_value,
    ord?.total_filled_value,
    resp?.order?.filled_value,
    resp?.order?.total_filled_value
  );

  const avgFilledPrice = firstNum(
    ord?.average_filled_price,
    ord?.avg_filled_price,
    ord?.average_filled_price?.value,
    resp?.order?.average_filled_price,
    resp?.order?.average_filled_price?.value
  );

  // Fees at order/response level
  const feeUsd = num(
    firstNum(
      raw?.fee,
      raw?.fees,
      raw?.total_fees,
      resp?.fee,
      resp?.fees,
      resp?.total_fees,
      resp?.order?.total_fees,
      resp?.order?.fees,
      ord?.total_fees,
      ord?.fees,
      feeFromFills
    ),
    0
  );

  // If no fills, BUY quote_size often lives in order_configuration (your example)
  const oc = raw?.order_configuration || {};
  const buyQuoteCfg = firstNum(
    oc?.market_market_ioc?.quote_size,
    oc?.market_market_ioc?.quote_value,
    oc?.market_ioc?.quote_size,
    oc?.market_ioc?.quote_value
  );

  // Final pick (priority: fills -> order fields -> row columns -> config)
  const base = firstNum(baseFromFills || null, filledSize, (r as any).base_size);
  const quote = firstNum(quoteFromFills || null, filledValue, (r as any).quote_size, buyQuoteCfg);
  const price = firstNum(pxFromFills, avgFilledPrice, (r as any).price);

  return {
    price,
    base,
    quote,
    feeUsd,
  };
}

type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string;
  orderId: string | null;

  price: number;       // 0 allowed if unknown
  baseQty: number;     // BTC size
  usdNotional: number; // USD amount (cost or proceeds)
  feeUsd: number;
  row: any;
};

function normalizeRow(r: TradeRow): NormalizedFill | null {
  const side = pickSide(r);
  if (!side) return null;

  const ts = pickTs(r);
  const symbol = pickSymbol(r);
  const orderId = extractOrderId(r);

  const ex = extractFromRaw(r);

  // Base/quote can still be missing on ACK-only rows.
  // We only accept rows with enough info to represent a real executed fill:
  // - BUY: needs quote OR (base+price)
  // - SELL: needs base OR (quote+price)
  let baseQty = ex.base ?? 0;
  let usdNotional = 0;

  if (side === "BUY") {
    if (ex.quote != null && ex.quote > 0) {
      usdNotional = ex.quote;
      if ((!baseQty || baseQty <= 0) && ex.price != null && ex.price > 0) {
        baseQty = ex.quote / ex.price;
      }
    } else if (baseQty > 0 && ex.price != null && ex.price > 0) {
      usdNotional = baseQty * ex.price;
    } else {
      // ACK-only market order with no fills yet -> skip for PnL
      return null;
    }
  } else {
    // SELL
    if (baseQty > 0) {
      if (ex.price != null && ex.price > 0) usdNotional = baseQty * ex.price;
      else if (ex.quote != null && ex.quote > 0) usdNotional = ex.quote;
      else usdNotional = 0; // still allow; bps may degrade
    } else if (ex.quote != null && ex.price != null && ex.quote > 0 && ex.price > 0) {
      usdNotional = ex.quote;
      baseQty = ex.quote / ex.price;
    } else {
      return null;
    }
  }

  // price: if unknown but we have base+usd, back into it
  let px = ex.price ?? 0;
  if ((!px || !Number.isFinite(px)) && baseQty > 0 && usdNotional > 0) {
    px = usdNotional / baseQty;
  }
  if (!Number.isFinite(px) || px <= 0) px = 0;

  return {
    ts,
    side,
    symbol,
    orderId,
    price: px,
    baseQty,
    usdNotional,
    feeUsd: num(ex.feeUsd, 0),
    row: r,
  };
}

// ---------- FIFO match + metrics ----------
type ClosedTrade = {
  openTs: string;
  closeTs: string;
  symbol: string;
  buyPx: number;
  sellPx: number;
  qty: number;
  pnlUsd: number;
  pnlBps: number | null;
  feesUsd: number;
};

type OpenLot = {
  ts: string;
  symbol: string;
  qty: number;
  costUsd: number;
  px: number;
  feesUsd: number;
};

function computeFromFills(fills: NormalizedFill[]) {
  const sorted = [...fills].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  const openLots: OpenLot[] = [];
  const closed: ClosedTrade[] = [];

  let feesPaid = 0;

  for (const f of sorted) {
    feesPaid += f.feeUsd || 0;

    if (f.side === "BUY") {
      openLots.push({
        ts: f.ts,
        symbol: f.symbol,
        qty: f.baseQty,
        costUsd: f.usdNotional,
        px: f.price || 0,
        feesUsd: f.feeUsd || 0,
      });
      continue;
    }

    // SELL -> match FIFO
    let sellQty = f.baseQty;

    while (sellQty > 0 && openLots.length > 0) {
      const lot = openLots[0];
      if (lot.symbol !== f.symbol) {
        openLots.shift();
        continue;
      }

      const takeQty = Math.min(lot.qty, sellQty);
      const lotCostPortion = lot.costUsd * (takeQty / lot.qty);
      const lotFeesPortion = lot.feesUsd * (takeQty / lot.qty);

      const proceedsPortion =
        f.usdNotional > 0 ? f.usdNotional * (takeQty / f.baseQty) :
        (f.price > 0 ? takeQty * f.price : 0);

      const pnlUsd = proceedsPortion - lotCostPortion;

      const buyPx =
        lot.px || (lotCostPortion > 0 && takeQty > 0 ? lotCostPortion / takeQty : 0);
      const sellPx =
        f.price || (proceedsPortion > 0 && takeQty > 0 ? proceedsPortion / takeQty : 0);

      let pnlBps: number | null = null;
      if (buyPx > 0 && sellPx > 0) pnlBps = ((sellPx - buyPx) / buyPx) * 10_000;

      closed.push({
        openTs: lot.ts,
        closeTs: f.ts,
        symbol: f.symbol,
        buyPx,
        sellPx,
        qty: takeQty,
        pnlUsd: Number(pnlUsd.toFixed(6)),
        pnlBps: pnlBps != null ? Number(pnlBps.toFixed(2)) : null,
        feesUsd: Number(((f.feeUsd || 0) + lotFeesPortion).toFixed(6)),
      });

      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feesUsd -= lotFeesPortion;
      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
      if (sellQty <= 1e-12) break;
    }
  }

  const realizedPnlUsd = closed.reduce((s, t) => s + t.pnlUsd, 0);

  const wins = closed.filter((t) => t.pnlUsd > 0);
  const losses = closed.filter((t) => t.pnlUsd < 0);

  const winRate = closed.length > 0 ? wins.length / closed.length : 0;

  const winBps = wins.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number");
  const lossBps = losses.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number");

  const avgWinBps = winBps.length ? winBps.reduce((a, b) => a + b, 0) / winBps.length : 0;
  const avgLossBps = lossBps.length ? lossBps.reduce((a, b) => a + b, 0) / lossBps.length : 0;

  return {
    closed,
    openLots,
    realizedPnlUsd: Number(realizedPnlUsd.toFixed(2)),
    feesPaidUsd: Number(feesPaid.toFixed(2)),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Number((winRate * 100).toFixed(2)),
    avg_win_bps: Number(avgWinBps.toFixed(2)),
    avg_loss_bps: Number(avgLossBps.toFixed(2)),
  };
}

function computeEquityAndMdd(closed: ClosedTrade[], startEquity = 0) {
  const s = [...closed].sort((a, b) => Date.parse(a.closeTs) - Date.parse(b.closeTs));

  let equity = startEquity;
  let peak = startEquity;
  let maxDdPct = 0;

  for (const t of s) {
    equity += t.pnlUsd;
    if (equity > peak) peak = equity;

    const dd = peak !== 0 ? ((peak - equity) / Math.abs(peak)) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  return {
    running_equity: Number(equity.toFixed(2)),
    peak_equity: Number(peak.toFixed(2)),
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

// ---------- spot price (public endpoint) ----------
async function fetchSpotPriceFromCoinbase(productId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/products/${encodeURIComponent(productId)}`,
      { method: "GET", cache: "no-store" }
    );
    const text = await res.text();
    const j = safeJsonParse(text) as any;
    const p = Number(j?.price) || Number(j?.product?.price) || Number(j?.data?.price) || 0;
    if (!Number.isFinite(p) || p <= 0) return null;
    return p;
  } catch {
    return null;
  }
}

function computeOpenPnlUsd(openLots: OpenLot[], spotPrice: number | null) {
  const totalQty = openLots.reduce((s, l) => s + (l.qty || 0), 0);
  const totalCost = openLots.reduce((s, l) => s + (l.costUsd || 0), 0);

  if (!spotPrice || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return {
      current_open_pnl_usd: null as number | null,
      open_position_base: Number(totalQty.toFixed(8)),
      open_cost_usd: Number(totalCost.toFixed(2)),
      spot_price: null as number | null,
    };
  }

  const mktValue = totalQty * spotPrice;
  const openPnl = mktValue - totalCost;

  return {
    current_open_pnl_usd: Number(openPnl.toFixed(2)),
    open_position_base: Number(totalQty.toFixed(8)),
    open_cost_usd: Number(totalCost.toFixed(2)),
    spot_price: Number(spotPrice.toFixed(2)),
  };
}

// ---------- handler ----------
export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const url = new URL(req.url);
  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(10_000, Math.max(100, num(url.searchParams.get("limit"), 5000)));
  const runId = `pnl_${shortId()}`;

  try {
    const client = sb();

    let q = client
      .from("trade_logs")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || error });

    const rows = Array.isArray(data) ? (data as any as TradeRow[]) : [];

    const fillsAll = rows.map(normalizeRow).filter((x): x is NormalizedFill => !!x);

    const full = computeFromFills(fillsAll);
    const equity = computeEquityAndMdd(full.closed, 0);

    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = fillsAll.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const last24 = computeFromFills(fills24);

    const symbol = fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";
    const spot = await fetchSpotPriceFromCoinbase(symbol);
    const open = computeOpenPnlUsd(full.openLots, spot);

    const payload = {
      ok: true,
      runId,
      user_id,
      since: sinceIso,
      rows_scanned: rows.length,
      fills_used: fillsAll.length,

      total_trades: full.totalTrades,
      wins: full.wins,
      losses: full.losses,
      win_rate: full.win_rate,
      avg_win_bps: full.avg_win_bps,
      avg_loss_bps: full.avg_loss_bps,
      net_realized_pnl_usd: full.realizedPnlUsd,
      fees_paid_usd: full.feesPaidUsd,

      current_open_pnl_usd: open.current_open_pnl_usd,
      open_position_base: open.open_position_base,
      running_equity: equity.running_equity,
      max_drawdown_pct: equity.max_drawdown_pct,

      last_24h: {
        since: last24Iso,
        total_trades: last24.totalTrades,
        wins: last24.wins,
        losses: last24.losses,
        win_rate: last24.win_rate,
        net_realized_pnl_usd: last24.realizedPnlUsd,
        fees_paid_usd: last24.feesPaidUsd,
      },

      debug: {
        symbol_used_for_spot: symbol,
        spot_price: open.spot_price,
        open_cost_usd: open.open_cost_usd,
        limit,
        example_first_order_id: fillsAll.find((f) => f.orderId)?.orderId ?? null,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}