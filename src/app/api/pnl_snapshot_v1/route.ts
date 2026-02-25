// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

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

function cleanString(v: any) {
  return (typeof v === "string" ? v : "").trim();
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toIsoMaybe(x: any): string | null {
  const s = cleanString(x);
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function nowIso() {
  return new Date().toISOString();
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
  created_at?: string;
  t?: string;

  user_id?: string | null;
  bot?: string | null;

  // these may or may not exist in your table, so we always access via (r as any)
  side?: string | null;
  order_id?: string | null;
  symbol?: string | null;

  // often NULL in your DB currently
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;

  raw?: any; // jsonb
};

function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}

function pickSide(r: TradeRow): "BUY" | "SELL" | null {
  const s = cleanString((r as any).side).toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  return null;
}

function pickOrderId(r: TradeRow): string | null {
  const s = cleanString((r as any).order_id);
  return s || null;
}

function pickSymbol(r: TradeRow): string {
  const s =
    cleanString((r as any).symbol) ||
    cleanString((r as any).product_id) ||
    cleanString((r as any).product) ||
    "BTC-USD";
  return s;
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

// best-effort fee in USD from raw json
function extractFeeUsd(raw: any): number {
  try {
    const j = raw ?? {};
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

// Normalized fill from DB row (DB may be incomplete; we only use what exists)
type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string;
  orderId: string | null;

  // if missing, we still compute notional-based stats
  price: number | null;

  // at least one of these must be present to be usable
  baseQty: number | null;
  usdNotional: number | null;

  feeUsd: number;
  row: any;
};

function normalizeRow(r: TradeRow): NormalizedFill | null {
  const side = pickSide(r);
  if (!side) return null;

  const ts = pickTs(r);
  const symbol = pickSymbol(r);
  const orderId = pickOrderId(r);

  const price = pickPrice(r);
  const base = pickBaseSize(r);
  const quote = pickQuoteSize(r);

  const feeUsd = extractFeeUsd((r as any).raw);

  // We consider a row usable if:
  // - BUY: quote_size exists OR (base_size + price exist)
  // - SELL: base_size exists OR (quote_size + price exist)
  let baseQty: number | null = null;
  let usdNotional: number | null = null;

  if (side === "BUY") {
    if (quote && quote > 0) {
      usdNotional = quote;
      baseQty = base && base > 0 ? base : price ? quote / price : null;
    } else if (base && base > 0 && price && price > 0) {
      baseQty = base;
      usdNotional = base * price;
    } else {
      return null;
    }
  } else {
    if (base && base > 0) {
      baseQty = base;
      usdNotional = price && price > 0 ? base * price : null; // if no price, we can’t compute proceeds
    } else if (quote && quote > 0 && price && price > 0) {
      usdNotional = quote;
      baseQty = quote / price;
    } else {
      return null;
    }
  }

  return {
    ts,
    side,
    symbol,
    orderId,
    price: price ?? null,
    baseQty,
    usdNotional,
    feeUsd,
    row: r,
  };
}

// ---------- FIFO realized PnL from notional (DB-only MVP) ----------
type OpenLot = {
  ts: string;
  symbol: string;
  qty: number;      // base qty
  costUsd: number;  // USD cost basis
  feeUsd: number;
  px: number | null;
};

type ClosedTrade = {
  openTs: string;
  closeTs: string;
  symbol: string;
  qty: number;
  buyUsd: number;
  sellUsd: number;
  pnlUsd: number;
  pnlBps: number | null;
  feesUsd: number;
};

function computeFromFills(fills: NormalizedFill[]) {
  const sorted = [...fills].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  const openLots: OpenLot[] = [];
  const closed: ClosedTrade[] = [];

  let feesPaidUsd = 0;

  for (const f of sorted) {
    feesPaidUsd += f.feeUsd || 0;

    if (f.side === "BUY") {
      if (!f.baseQty || !f.usdNotional) continue;

      openLots.push({
        ts: f.ts,
        symbol: f.symbol,
        qty: f.baseQty,
        costUsd: f.usdNotional,
        feeUsd: f.feeUsd || 0,
        px: f.price,
      });
      continue;
    }

    // SELL
    if (!f.baseQty) continue;

    let sellQty = f.baseQty;
    const sellUsdTotal = f.usdNotional ?? null;

    while (sellQty > 0 && openLots.length > 0) {
      const lot = openLots[0];

      if (lot.symbol !== f.symbol) {
        openLots.shift();
        continue;
      }

      const takeQty = Math.min(lot.qty, sellQty);

      // proportional cost + fee from lot
      const lotCostPortion = lot.costUsd * (takeQty / lot.qty);
      const lotFeePortion = lot.feeUsd * (takeQty / lot.qty);

      // proportional proceeds from SELL if we have it
      let sellUsdPortion: number | null = null;
      if (sellUsdTotal !== null && Number.isFinite(sellUsdTotal) && f.baseQty > 0) {
        sellUsdPortion = sellUsdTotal * (takeQty / f.baseQty);
      } else if (f.price && f.price > 0) {
        sellUsdPortion = takeQty * f.price;
      }

      if (sellUsdPortion === null) {
        // cannot compute realized pnl without proceeds
        // still consume inventory to avoid hanging
        lot.qty -= takeQty;
        lot.costUsd -= lotCostPortion;
        lot.feeUsd -= lotFeePortion;
        sellQty -= takeQty;
        if (lot.qty <= 1e-12) openLots.shift();
        continue;
      }

      const pnlUsd = sellUsdPortion - lotCostPortion;

      // bps if both sides have prices
      let pnlBps: number | null = null;
      const buyPx =
        lot.px && lot.px > 0 ? lot.px : lotCostPortion > 0 ? lotCostPortion / takeQty : 0;
      const sellPx =
        f.price && f.price > 0 ? f.price : sellUsdPortion > 0 ? sellUsdPortion / takeQty : 0;

      if (buyPx > 0 && sellPx > 0) {
        pnlBps = Number((((sellPx - buyPx) / buyPx) * 10_000).toFixed(2));
      }

      closed.push({
        openTs: lot.ts,
        closeTs: f.ts,
        symbol: f.symbol,
        qty: takeQty,
        buyUsd: Number(lotCostPortion.toFixed(2)),
        sellUsd: Number(sellUsdPortion.toFixed(2)),
        pnlUsd: Number(pnlUsd.toFixed(2)),
        pnlBps,
        feesUsd: Number(((f.feeUsd || 0) + lotFeePortion).toFixed(4)),
      });

      // reduce lot
      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feeUsd -= lotFeePortion;

      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
      if (sellQty <= 1e-12) break;
    }
  }

  const realizedPnlUsd = Number(
    closed.reduce((s, t) => s + (Number.isFinite(t.pnlUsd) ? t.pnlUsd : 0), 0).toFixed(2)
  );

  const wins = closed.filter((t) => t.pnlUsd > 0);
  const losses = closed.filter((t) => t.pnlUsd < 0);

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  const avgWinBps =
    wins.length > 0
      ? Number(
          (
            wins
              .map((t) => t.pnlBps)
              .filter((x): x is number => typeof x === "number")
              .reduce((a, b) => a + b, 0) / wins.length
          ).toFixed(2)
        )
      : 0;

  const avgLossBps =
    losses.length > 0
      ? Number(
          (
            losses
              .map((t) => t.pnlBps)
              .filter((x): x is number => typeof x === "number")
              .reduce((a, b) => a + b, 0) / losses.length
          ).toFixed(2)
        )
      : 0;

  // open inventory summary
  const openQty = Number(openLots.reduce((s, l) => s + l.qty, 0).toFixed(8));
  const openCostUsd = Number(openLots.reduce((s, l) => s + l.costUsd, 0).toFixed(2));

  return {
    closed,
    openLots,
    openQty,
    openCostUsd,
    realizedPnlUsd,
    feesPaidUsd: Number(feesPaidUsd.toFixed(2)),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Number(winRate.toFixed(2)),
    avgWinBps,
    avgLossBps,
  };
}

// realized-only equity curve (safe)
function computeEquityAndMdd(closed: ClosedTrade[], startEquity = 0) {
  const s = [...closed].sort((a, b) => Date.parse(a.closeTs) - Date.parse(b.closeTs));

  let equity = startEquity;
  let peak = startEquity;
  let maxDdPct = 0;

  for (const t of s) {
    equity += t.pnlUsd;
    if (equity > peak) peak = equity;

    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  return {
    running_equity: Number(equity.toFixed(2)),
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

// ---------- public spot price ----------
async function fetchSpotPrice(productId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/api/v3/brokerage/products/${encodeURIComponent(productId)}`,
      { method: "GET", cache: "no-store" }
    );
    const text = await res.text();
    const j = safeJsonParse(text) as any;

    const p =
      Number(j?.price) ||
      Number(j?.product?.price) ||
      Number(j?.data?.price) ||
      0;

    if (!Number.isFinite(p) || p <= 0) return null;
    return p;
  } catch {
    return null;
  }
}

// ---------- handler ----------
export async function GET(req: Request) {
  if (!okAdminAuth(req)) return json(401, { ok: false, error: "unauthorized" });

  const runId = `pnl_${shortId()}`;
  const url = new URL(req.url);

  const user_id = cleanString(url.searchParams.get("user_id")) || null;

  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso =
    toIsoMaybe(sinceParam) ||
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const limit = Math.min(10_000, Math.max(100, num(url.searchParams.get("limit"), 5000)));

  try {
    const client = sb();

    // IMPORTANT: select("*") so we never reference non-existent columns (like product_id)
    let q = client
      .from("trade_logs")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || String(error) });

    const rows = Array.isArray(data) ? (data as TradeRow[]) : [];

    const fillsAll = rows.map(normalizeRow).filter((x): x is NormalizedFill => !!x);

    const statsAll = computeFromFills(fillsAll);
    const equityAll = computeEquityAndMdd(statsAll.closed, 0);

    // last 24h slice
    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = fillsAll.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const stats24 = computeFromFills(fills24);

    // symbol for spot (default BTC-USD)
    const symbolUsed =
      fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";

    const spot = await fetchSpotPrice(symbolUsed);

    // ---- OPEN PnL (this is where your TS build failed before) ----
    // openValue can be null, so we only do math when it’s a number.
    const openValue: number | null =
      spot !== null ? Number((statsAll.openQty * spot).toFixed(2)) : null;

    const current_open_pnl_usd: number | null =
      spot !== null && openValue !== null
        ? Number((openValue - statsAll.openCostUsd).toFixed(2))
        : null;

    const payload = {
      ok: true,
      runId,
      user_id,
      since: sinceIso,

      rows_scanned: rows.length,
      fills_used: fillsAll.length,

      // MVP scoreboard (DB-only)
      total_trades: statsAll.totalTrades,
      wins: statsAll.wins,
      losses: statsAll.losses,
      win_rate: statsAll.winRate,
      avg_win_bps: statsAll.avgWinBps,
      avg_loss_bps: statsAll.avgLossBps,

      net_realized_pnl_usd: statsAll.realizedPnlUsd,
      fees_paid_usd: statsAll.feesPaidUsd,

      // Open position + MTM
      open_position_base: statsAll.openQty,
      open_cost_usd: statsAll.openCostUsd,
      spot_price: spot,
      current_open_pnl_usd,

      // Realized-only equity & DD (safe / deterministic)
      running_equity: equityAll.running_equity,
      max_drawdown_pct: equityAll.max_drawdown_pct,

      last_24h: {
        since: last24Iso,
        total_trades: stats24.totalTrades,
        wins: stats24.wins,
        losses: stats24.losses,
        win_rate: stats24.winRate,
        net_realized_pnl_usd: stats24.realizedPnlUsd,
        fees_paid_usd: stats24.feesPaidUsd,
      },

      debug: {
        symbol_used_for_spot: symbolUsed,
        limit,
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}