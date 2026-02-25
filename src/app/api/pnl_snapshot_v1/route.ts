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
function sbHostSafe() {
  try {
    const u = new URL(requireEnv("SUPABASE_URL"));
    return u.hostname; // safe (no key)
  } catch {
    return "unknown";
  }
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
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;
  mode?: string | null;
  ok?: boolean | null;
  raw?: any;
  decision?: any;
  reason?: string | null;
};

// ---------- parsing ----------
function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}
function pickSymbol(r: TradeRow): string {
  return cleanString(r.symbol) || cleanString((r as any).product_id) || "UNKNOWN";
}
function pickSide(r: TradeRow): "BUY" | "SELL" | null {
  const s = cleanString(r.side).toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  return null;
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
  } catch {}
  return 0;
}

type NormalizedFill = {
  ts: string;
  side: "BUY" | "SELL";
  symbol: string;
  price: number;
  baseQty: number;
  usdNotional: number;
  feeUsd: number;
  row: any;
};

function normalizeRow(r: TradeRow): NormalizedFill | null {
  const side = pickSide(r);
  if (!side) return null;

  const ts = pickTs(r);
  const symbol = pickSymbol(r);

  const price = pickPrice(r);
  const base = pickBaseSize(r);
  const quote = pickQuoteSize(r);

  let baseQty = base ?? 0;
  let usdNotional = 0;

  if (side === "BUY") {
    if (quote && quote > 0) {
      usdNotional = quote;
      if (!baseQty && price) baseQty = quote / price;
    } else if (baseQty && price) {
      usdNotional = baseQty * price;
    } else {
      return null;
    }
  } else {
    if (baseQty && baseQty > 0) {
      usdNotional = price ? baseQty * price : 0;
    } else if (quote && price) {
      usdNotional = quote;
      baseQty = quote / price;
    } else {
      return null;
    }
  }

  let px = price ?? 0;
  if ((!px || !Number.isFinite(px)) && baseQty > 0 && usdNotional > 0) {
    px = usdNotional / baseQty;
  }
  if (!Number.isFinite(px) || px <= 0) px = 0;

  const feeUsd = extractFeeUsd((r as any).raw);

  return { ts, side, symbol, price: px, baseQty, usdNotional, feeUsd, row: r };
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

      let proceedsPortion = 0;
      if (f.usdNotional > 0 && f.baseQty > 0) {
        proceedsPortion = f.usdNotional * (takeQty / f.baseQty);
      } else if (f.price > 0) {
        proceedsPortion = takeQty * f.price;
      }

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
        pnlUsd,
        pnlBps: pnlBps !== null ? Number(pnlBps.toFixed(2)) : null,
        feesUsd: (f.feeUsd || 0) + lotFeesPortion,
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
  const win_rate = closed.length > 0 ? wins.length / closed.length : 0;

  const avg_win_bps =
    wins.length > 0
      ? wins
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number")
          .reduce((a, b) => a + b, 0) / wins.length
      : 0;

  const avg_loss_bps =
    losses.length > 0
      ? losses
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number")
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
    win_rate: Number((win_rate * 100).toFixed(2)),
    avg_win_bps: Number(avg_win_bps.toFixed(2)),
    avg_loss_bps: Number(avg_loss_bps.toFixed(2)),
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

    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  return {
    running_equity: Number(equity.toFixed(2)),
    max_drawdown_pct: Number(maxDdPct.toFixed(3)),
  };
}

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
  const totalQty = openLots.reduce((s, l) => s + l.qty, 0);
  const totalCost = openLots.reduce((s, l) => s + l.costUsd, 0);

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

  // IMPORTANT: only filter by created_at if caller provides since=
  const sinceParam = cleanString(url.searchParams.get("since"));
  const sinceIso = toIsoMaybe(sinceParam); // null means "no date filter"

  const limit = Math.min(10_000, Math.max(100, num(url.searchParams.get("limit"), 5000)));
  const runId = `pnl_${shortId()}`;

  try {
    const client = sb();

    // Count all rows (diag)
    const { count: totalCount, error: countErr } = await client
      .from("trade_logs")
      .select("*", { count: "exact", head: true });

    // Pull rows
    let q = client.from("trade_logs").select("*").order("created_at", { ascending: true }).limit(limit);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (user_id) q = q.eq("user_id", user_id);

    const { data, error } = await q;
    if (error) return json(500, { ok: false, runId, error: error.message || error });

    const rows = Array.isArray(data) ? (data as any as TradeRow[]) : [];
    const fillsAll = rows.map(normalizeRow).filter((x): x is NormalizedFill => !!x);

    const full = computeFromFills(fillsAll);
    const equity = computeEquityAndMdd(full.closed, 0);

    const symbol = fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";
    const spot = await fetchSpotPriceFromCoinbase(symbol);
    const open = computeOpenPnlUsd(full.openLots, spot);

    return json(200, {
      ok: true,
      runId,
      user_id,
      since: sinceIso, // null means no filter
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

      running_equity: equity.running_equity,
      max_drawdown_pct: equity.max_drawdown_pct,

      debug: {
        supabase_host: sbHostSafe(),
        db_total_rows: countErr ? null : totalCount,
        count_error: countErr ? String((countErr as any)?.message || countErr) : null,
        spot_price: open.spot_price,
        symbol_used_for_spot: symbol,
        limit,
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}