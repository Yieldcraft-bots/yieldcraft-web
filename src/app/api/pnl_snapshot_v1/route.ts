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

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
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
  symbol?: string;
  product_id?: string;
  side?: string;
  price?: number | string | null;
  base_size?: number | string | null;
  quote_size?: number | string | null;
  mode?: string | null;
  ok?: boolean | null;
  raw?: any; // jsonb
  decision?: any; // jsonb
  reason?: string | null;
};

// ---------- parsing ----------
function pickTs(r: TradeRow): string {
  return toIsoMaybe(r.created_at) || toIsoMaybe((r as any).t) || nowIso();
}

function pickSymbol(r: TradeRow): string {
  return (
    cleanString(r.symbol) ||
    cleanString((r as any).product_id) ||
    "UNKNOWN"
  );
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

// Try to pull fee USD from raw payloads (best-effort)
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
      j?.response?.order?.total_fees,
      j?.response?.order?.fees,
    ];

    for (const c of candidates) {
      if (c == null) continue;

      if (typeof c === "number" && Number.isFinite(c)) return c;

      if (typeof c === "string") {
        const n = Number(c);
        if (Number.isFinite(n)) return n;
      }

      // some Coinbase fields are like { value: "0.12", currency: "USD" }
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
  price: number; // 0 if unknown
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

  // back into price if missing
  let px = price ?? 0;
  if ((!px || !Number.isFinite(px)) && baseQty > 0 && usdNotional > 0) {
    px = usdNotional / baseQty;
  }
  if (!Number.isFinite(px) || px <= 0) px = 0;

  const feeUsd = extractFeeUsd((r as any).raw);

  return {
    ts,
    side,
    symbol,
    price: px,
    baseQty,
    usdNotional,
    feeUsd: Number.isFinite(feeUsd) ? feeUsd : 0,
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
    feesPaid += safeNumber(f.feeUsd, 0);

    if (f.side === "BUY") {
      openLots.push({
        ts: f.ts,
        symbol: f.symbol,
        qty: safeNumber(f.baseQty, 0),
        costUsd: safeNumber(f.usdNotional, 0),
        px: safeNumber(f.price, 0),
        feesUsd: safeNumber(f.feeUsd, 0),
      });
      continue;
    }

    let sellQty = safeNumber(f.baseQty, 0);

    while (sellQty > 0 && openLots.length > 0) {
      const lot = openLots[0];

      if (lot.symbol !== f.symbol) {
        openLots.shift();
        continue;
      }

      const lotQtyBefore = lot.qty;
      if (lotQtyBefore <= 0) {
        openLots.shift();
        continue;
      }

      const takeQty = Math.min(lot.qty, sellQty);

      const lotCostPortion = lot.costUsd * (takeQty / lotQtyBefore);
      const lotFeesPortion = lot.feesUsd * (takeQty / lotQtyBefore);

      // proceeds portion (use notional if present; otherwise fallback to px*qty)
      let proceedsPortion = 0;
      if (safeNumber(f.usdNotional, 0) > 0 && safeNumber(f.baseQty, 0) > 0) {
        proceedsPortion = f.usdNotional * (takeQty / f.baseQty);
      } else if (safeNumber(f.price, 0) > 0) {
        proceedsPortion = takeQty * f.price;
      } else {
        proceedsPortion = 0;
      }

      const pnlUsd = safeNumber(proceedsPortion, 0) - safeNumber(lotCostPortion, 0);

      const buyPx =
        safeNumber(lot.px, 0) ||
        (lotCostPortion > 0 && takeQty > 0 ? lotCostPortion / takeQty : 0);

      const sellPx =
        safeNumber(f.price, 0) ||
        (proceedsPortion > 0 && takeQty > 0 ? proceedsPortion / takeQty : 0);

      let pnlBps: number | null = null;
      if (buyPx > 0 && sellPx > 0) {
        const bps = ((sellPx - buyPx) / buyPx) * 10_000;
        pnlBps = Number.isFinite(bps) ? Number(bps.toFixed(2)) : null;
      }

      closed.push({
        openTs: lot.ts,
        closeTs: f.ts,
        symbol: f.symbol,
        buyPx,
        sellPx,
        qty: takeQty,
        pnlUsd: Number.isFinite(pnlUsd) ? Number(pnlUsd.toFixed(6)) : 0,
        pnlBps,
        feesUsd: safeNumber(f.feeUsd, 0) + safeNumber(lotFeesPortion, 0),
      });

      // reduce lot
      lot.qty -= takeQty;
      lot.costUsd -= lotCostPortion;
      lot.feesUsd -= lotFeesPortion;

      sellQty -= takeQty;

      if (lot.qty <= 1e-12) openLots.shift();
      if (sellQty <= 1e-12) break;
    }
  }

  const realizedPnlUsdRaw = closed.reduce((s, t) => s + safeNumber(t.pnlUsd, 0), 0);

  const wins = closed.filter((t) => safeNumber(t.pnlUsd, 0) > 0);
  const losses = closed.filter((t) => safeNumber(t.pnlUsd, 0) < 0);

  const winRatePct = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  const avgWinBps =
    wins.length > 0
      ? wins
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
          .reduce((a, b) => a + b, 0) / wins.length
      : 0;

  const avgLossBps =
    losses.length > 0
      ? losses
          .map((t) => t.pnlBps)
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
          .reduce((a, b) => a + b, 0) / losses.length
      : 0;

  return {
    closed,
    openLots,
    realizedPnlUsd: Number.isFinite(realizedPnlUsdRaw) ? Number(realizedPnlUsdRaw.toFixed(2)) : 0,
    feesPaidUsd: Number.isFinite(feesPaid) ? Number(feesPaid.toFixed(2)) : 0,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Number.isFinite(winRatePct) ? Number(winRatePct.toFixed(2)) : 0,
    avg_win_bps: Number.isFinite(avgWinBps) ? Number(avgWinBps.toFixed(2)) : 0,
    avg_loss_bps: Number.isFinite(avgLossBps) ? Number(avgLossBps.toFixed(2)) : 0,
  };
}

// Max drawdown computed from realized-only equity curve
function computeEquityAndMdd(closed: ClosedTrade[], startEquity = 0) {
  const s = [...closed].sort((a, b) => Date.parse(a.closeTs) - Date.parse(b.closeTs));

  let equity = startEquity;
  let peak = startEquity;
  let maxDdPct = 0;

  for (const t of s) {
    equity += safeNumber(t.pnlUsd, 0);
    if (equity > peak) peak = equity;

    const dd = peak !== 0 ? ((peak - equity) / Math.max(Math.abs(peak), 1e-9)) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }

  return {
    running_equity: Number.isFinite(equity) ? Number(equity.toFixed(2)) : 0,
    peak_equity: Number.isFinite(peak) ? Number(peak.toFixed(2)) : 0,
    max_drawdown_pct: Number.isFinite(maxDdPct) ? Number(maxDdPct.toFixed(3)) : 0,
  };
}

// ---------- spot (open pnl) ----------
// Public Coinbase v2 spot endpoint (no auth)
async function fetchSpotPriceFromCoinbase(
  _apiKeyName: string,
  _privateKeyPem: string,
  _keyAlg: "ES256" | "EdDSA",
  productId: string
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/v2/prices/${encodeURIComponent(productId)}/spot`,
      { method: "GET", cache: "no-store" }
    );
    const j = (await res.json()) as any;
    const p = Number(j?.data?.amount);
    if (!Number.isFinite(p) || p <= 0) return null;
    return p;
  } catch {
    return null;
  }
}

function computeOpenPnlUsd(openLots: OpenLot[], spotPrice: number | null) {
  const totalQty = openLots.reduce((s, l) => s + safeNumber(l.qty, 0), 0);
  const totalCost = openLots.reduce((s, l) => s + safeNumber(l.costUsd, 0), 0);

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
    current_open_pnl_usd: Number.isFinite(openPnl) ? Number(openPnl.toFixed(2)) : 0,
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

    const rows = Array.isArray(data) ? (data as TradeRow[]) : [];

    const fillsAll = rows.map(normalizeRow).filter((x): x is NormalizedFill => !!x);

    const full = computeFromFills(fillsAll);
    const equity = computeEquityAndMdd(full.closed, 0);

    const last24Iso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const fills24 = fillsAll.filter((f) => Date.parse(f.ts) >= Date.parse(last24Iso));
    const last24 = computeFromFills(fills24);

    const symbol =
      fillsAll.find((f) => f.symbol && f.symbol !== "UNKNOWN")?.symbol || "BTC-USD";

    const spot = await fetchSpotPriceFromCoinbase("", "", "ES256", symbol);
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
      win_rate: full.win_rate, // percent
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
      },
    };

    return json(200, payload);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}