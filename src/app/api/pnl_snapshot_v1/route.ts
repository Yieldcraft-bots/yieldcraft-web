// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ---------- helpers ----------
function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}
function num(v: any, fallback: number) {
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
  created_at?: string; // supabase default timestamp
  t?: string; // sometimes you log "t"
  user_id?: string;
  bot?: string;

  // these are often NULL in your table (per screenshot)
  symbol?: string;
  product_id?: string;
  side?: string;
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;

  // you DO have these
  order_id?: string | null;

  ok?: boolean | null;
  raw?: any; // jsonb
  decision?: any; // jsonb
  reason?: string | null;
};

// ---------- parsing ----------
function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}

function pickSide(r: TradeRow): "BUY" | "SELL" | null {
  const s = cleanString(r.side).toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  return null;
}

function pickSymbol(r: TradeRow): string {
  // prefer explicit symbol/product_id; then raw.request.product_id; then raw.response.*.product_id
  const raw = (r as any).raw ?? {};
  const fromRaw =
    cleanString(raw?.request?.product_id) ||
    cleanString(raw?.response?.success_response?.product_id) ||
    cleanString(raw?.success_response?.product_id) ||
    cleanString(raw?.order?.product_id);

  return cleanString(r.symbol) || cleanString((r as any).product_id) || fromRaw || "BTC-USD";
}

function pickPrice(r: TradeRow): number | null {
  const p = Number((r as any).price);
  return Number.isFinite(p) && p > 0 ? p : null;
}
function pickBaseSize(r: TradeRow): number | null {
  const b = Number((r as any).base_size);
  return Number.isFinite(b) && b > 0 ? b : null;
}
function pickQuoteSize(r: TradeRow): number | null {
  const q = Number((r as any).quote_size);
  return Number.isFinite(q) && q > 0 ? q : null;
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Try to pull fee USD from raw payloads (best-effort)
function extractFeeUsd(raw: any): number {
  try {
    const j = raw ?? {};

    // Coinbase fills often include fee/commission values
    const fills = (j?.fills || j?.order?.fills || j?.response?.fills || []) as any[];
    if (Array.isArray(fills) && fills.length) {
      let fee = 0;
      for (const f of fills) {
        // common patterns
        fee += toNum(f?.commission_value);
        fee += toNum(f?.fee);
        fee += toNum(f?.fees);
        // sometimes fee is like { value: "0.12", currency: "USD" }
        const v = toNum(f?.fee?.value);
        if (v) fee += v;
      }
      if (fee > 0) return fee;
    }

    const candidates = [
      j?.fee,
      j?.fees,
      j?.total_fees,
      j?.order?.total_fees,
      j?.order?.fees,
      j?.success_response?.order?.total_fees,
      j?.success_response?.order?.fees,
      j?.resp?.order?.total_fees,
      j?.resp?.order?.fees,
    ];

    for (const c of candidates) {
      if (c == null) continue;
      if (typeof c === "number" && Number.isFinite(c)) return c;
      if (typeof c === "string") {
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }
      if (typeof c === "object") {
        const v = Number((c as any)?.value);
        if (Number.isFinite(v)) return v;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string;
  price: number;       // avg fill price if possible; else 0
  baseQty: number;     // BTC size
  usdNotional: number; // USD amount (cost or proceeds)
  feeUsd: number;      // best-effort
  orderId?: string | null;
  row: any;
};

// BIG FIX: derive base/price from raw.fills[] when DB price/base_size are NULL
function deriveFromRaw(r: TradeRow): { baseQty: number; usdNotional: number; avgPrice: number } | null {
  const raw = (r as any).raw ?? {};
  const fills = (raw?.fills || raw?.order?.fills || raw?.response?.fills) as any;

  if (Array.isArray(fills) && fills.length) {
    let base = 0;
    let usd = 0;

    for (const f of fills) {
      const size = toNum(f?.size ?? f?.filled_size ?? f?.base_size ?? f?.amount);
      const price = toNum(f?.price ?? f?.fill_price ?? f?.rate);
      if (size > 0) base += size;
      if (size > 0 && price > 0) usd += size * price;
    }

    if (base > 0) {
      const avgPrice = usd > 0 ? usd / base : 0;
      return { baseQty: base, usdNotional: usd, avgPrice };
    }
  }

  // some responses store filled_size + average_filled_price
  const filledSize = toNum(raw?.order?.filled_size ?? raw?.filled_size);
  const avgPx = toNum(raw?.order?.average_filled_price ?? raw?.average_filled_price);

  if (filledSize > 0 && avgPx > 0) {
    return { baseQty: filledSize, usdNotional: filledSize * avgPx, avgPrice: avgPx };
  }

  return null;
}

function normalizeRow(r: TradeRow): NormalizedFill | null {
  const side = pickSide(r);
  if (!side) return null;

  const ts = pickTs(r);
  const symbol = pickSymbol(r);
  const orderId = (r as any).order_id ?? null;

  // Prefer explicit DB columns if present
  let price = pickPrice(r);
  let base = pickBaseSize(r);
  let quote = pickQuoteSize(r);

  // If DB columns are missing (your case), derive from raw fills
  if ((!price || !base) && (r as any).raw) {
    const d = deriveFromRaw(r);
    if (d) {
      base = base && base > 0 ? base : d.baseQty;
      // only overwrite quote if db quote is missing
      quote = quote && quote > 0 ? quote : d.usdNotional;
      price = price && price > 0 ? price : d.avgPrice;
    }
  }

  // Compute notional/base with sensible rules
  let baseQty = base ?? 0;
  let usdNotional = quote ?? 0;

  if (side === "BUY") {
    // BUY: if we only have quote, allow it (we'll still compute base if we have price)
    if (usdNotional <= 0 && baseQty > 0 && price && price > 0) {
      usdNotional = baseQty * price;
    }
    if (baseQty <= 0 && usdNotional > 0 && price && price > 0) {
      baseQty = usdNotional / price;
    }

    // if still missing base, we can't match FIFO later
    if (baseQty <= 0 && usdNotional <= 0) return null;
  } else {
    // SELL: prefer base; if only quote and price, infer base
    if (baseQty <= 0 && usdNotional > 0 && price && price > 0) {
      baseQty = usdNotional / price;
    }
    if (usdNotional <= 0 && baseQty > 0 && price && price > 0) {
      usdNotional = baseQty * price;
    }

    if (baseQty <= 0 && usdNotional <= 0) return null;
  }

  // If price still missing but we have base+usd, back into price
  let px = price ?? 0;
  if ((!px || !Number.isFinite(px)) && baseQty > 0 && usdNotional > 0) {
    px = usdNotional / baseQty;
  }
  if (!Number.isFinite(px) || px <= 0) px = 0;

  const feeUsd = extractFeeUsd((r as any).raw);

  return { ts, side, symbol, price: px, baseQty, usdNotional, feeUsd, orderId, row: r };
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
      // costUsd = usdNotional (BUY)
      openLots.push({
        ts: f.ts,
        symbol: f.symbol,
        qty: f.baseQty,
        costUsd: f.usdNotional,
        px: f.price || (f.baseQty > 0 ? f.usdNotional / f.baseQty : 0),
        feesUsd: f.feeUsd || 0,
      });
      continue;
    }

    // SELL -> match FIFO
    let sellQty = f.baseQty;
    while (sellQty > 1e-12 && openLots.length > 0) {
      const lot = openLots[0];
      if (lot.symbol !== f.symbol) {
        // don't match across symbols
        openLots.shift();
        continue;
      }

      const takeQty = Math.min(lot.qty, sellQty);

      const lotCostPortion = lot.costUsd * (takeQty / lot.qty);
      const lotFeesPortion = lot.feesUsd * (takeQty / lot.qty);

      // proceeds for this portion
      const proceedsPortion =
        f.usdNotional > 0
          ? f.usdNotional * (takeQty / f.baseQty)
          : f.price > 0
            ? takeQty * f.price
            : 0;

      const pnlUsd = proceedsPortion - lotCostPortion;

      const buyPx = lot.px || (takeQty > 0 ? lotCostPortion / takeQty : 0);
      const sellPx = f.price || (takeQty > 0 ? proceedsPortion / takeQty : 0);

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
        pnlBps: pnlBps !== null ? Number(pnlBps.toFixed(2)) : null,
        feesUsd: Number(((f.feeUsd || 0) + lotFeesPortion).toFixed(6)),
      });

      // reduce lot
      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feesUsd -= lotFeesPortion;

      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
    }
  }

  const realizedPnlUsd = closed.reduce((s, t) => s + t.pnlUsd, 0);
  const wins = closed.filter((t) => t.pnlUsd > 0);
  const losses = closed.filter((t) => t.pnlUsd < 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;

  const avgWinBps =
    wins.length > 0
      ? wins.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number")
          .reduce((a, b) => a + b, 0) / wins.length
      : 0;

  const avgLossBps =
    losses.length > 0
      ? losses.map((t) => t.pnlBps).filter((x): x is number => typeof x === "number")
          .reduce((a, b) => a + b, 0) / losses.length
      : 0;

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
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

// ---------- public spot for open pnl ----------
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

function computeOpenPnl(openLots: OpenLot[], spotPrice: number | null) {
  const totalQty = openLots.reduce((s, l) => s + l.qty, 0);
  const totalCost = openLots.reduce((s, l) => s + l.costUsd, 0);

  if (!spotPrice || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return {
      open_position_base: Number(totalQty.toFixed(8)),
      open_cost_usd: Number(totalCost.toFixed(2)),
      current_open_pnl_usd: null as number | null,
      spot_price: null as number | null,
    };
  }

  const mktValue = totalQty * spotPrice;
  const openPnl = mktValue - totalCost;

  return {
    open_position_base: Number(totalQty.toFixed(8)),
    open_cost_usd: Number(totalCost.toFixed(2)),
    current_open_pnl_usd: Number(openPnl.toFixed(2)),
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
    toIsoMaybe(sinceParam) || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

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

    const rows = Array.isArray(data) ? (data as TradeRow[]) : [];

    const fillsAll = rows.map(normalizeRow).filter((x): x is NormalizedFill => !!x);

    const full = computeFromFills(fillsAll);
    const equity = computeEquityAndMdd(full.closed, 0);

    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = fillsAll.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const last24 = computeFromFills(fills24);

    const symbol = fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";
    const spot = await fetchSpotPriceFromCoinbase(symbol);
    const open = computeOpenPnl(full.openLots, spot);

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
      open_cost_usd: open.open_cost_usd,
      spot_price: open.spot_price,

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
        limit,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}