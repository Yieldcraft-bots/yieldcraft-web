// src/app/api/pnl_snapshot_v1/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * PnL Snapshot (server)
 * - Reads trade_logs
 * - Computes realized PnL via FIFO matching (BUY lots matched to SELL)
 * - Computes open position + open PnL from last seen price (best-effort)
 *
 * Query:
 *  - secret=... (or header x-cron-secret / authorization)
 *  - since=ISO (default: 2025-12-01T00:00:00.000Z)
 *  - limit=number (default 10000)
 *  - user_id=... (optional)
 *  - symbol=BTC-USD (optional, default BTC-USD)
 */

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
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

function nowIso() {
  return new Date().toISOString();
}

function shortId() {
  return crypto.randomBytes(6).toString("hex");
}

function okAuth(req: Request) {
  const secret = (process.env.CRON_SECRET || process.env.YC_CRON_SECRET || "").trim();
  if (!secret) return false;

  const h =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization") ||
    req.headers.get("x-yc-secret");

  if (h && (h === secret || h === `Bearer ${secret}`)) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  return q === secret;
}

function sb() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---- Types we expect in trade_logs (best effort) ----
type TradeRow = {
  created_at: string;
  user_id: string | null;
  symbol: string | null;
  side: "BUY" | "SELL" | string;
  order_id: string | null;
  base_size: number | null;   // BTC amount
  quote_size: number | null;  // USD notional
  price: number | null;       // avg price (USD)
  ok?: boolean | null;
};

type Lot = { qty: number; price: number; time: string; order_id?: string | null };

function safeSide(s: any): "BUY" | "SELL" | "OTHER" {
  const v = String(s || "").toUpperCase();
  if (v === "BUY") return "BUY";
  if (v === "SELL") return "SELL";
  return "OTHER";
}

function round2(x: number) {
  return Number(x.toFixed(2));
}
function round4(x: number) {
  return Number(x.toFixed(4));
}

function bps(a: number, b: number) {
  // (a-b)/b * 10_000
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / b) * 10_000;
}

export async function GET(req: Request) {
  try {
    if (!okAuth(req)) return json(401, { ok: false, error: "unauthorized" });

    const url = new URL(req.url);

    const runId = `pnl_${shortId()}`;

    const since = cleanString(url.searchParams.get("since")) || "2025-12-01T00:00:00.000Z";
    const limit = Math.max(1, Math.min(100000, num(url.searchParams.get("limit"), 10000)));

    // Optional filters
    const symbol = (cleanString(url.searchParams.get("symbol")) || "BTC-USD").toUpperCase();
    const user_id_q = cleanString(url.searchParams.get("user_id")) || null;

    // Safety: allow forcing one user via env
    const ONLY_USER_ID = (process.env.PULSE_ONLY_USER_ID || "").trim() || null;
    const user_id = ONLY_USER_ID || user_id_q;

    const client = sb();

    // Pull trades
    // We keep selection tight to avoid giant payloads.
    let q = client
      .from("trade_logs")
      .select("created_at,user_id,symbol,side,order_id,base_size,quote_size,price,ok")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);
    if (symbol) q = q.eq("symbol", symbol);

    const { data, error } = await q;
    if (error) {
      return json(500, { ok: false, runId, error: error.message || error });
    }

    const rows = (Array.isArray(data) ? (data as any as TradeRow[]) : []).filter(Boolean);

    // Filter to usable rows (need side + some sizing; we prefer base_size+price, but allow quote_size).
    const usable: TradeRow[] = rows.filter((r) => {
      const side = safeSide(r.side);
      if (side === "OTHER") return false;
      const b = Number(r.base_size ?? 0);
      const qv = Number(r.quote_size ?? 0);
      const p = Number(r.price ?? 0);
      return (Number.isFinite(b) && b > 0) || (Number.isFinite(qv) && qv > 0) || (Number.isFinite(p) && p > 0);
    });

    // FIFO matching
    const buys: Lot[] = [];
    const realizedTrades: {
      time: string;
      entry_price: number;
      exit_price: number;
      qty: number;
      pnl_usd: number;
      pnl_bps: number;
      entry_order_id?: string | null;
      exit_order_id?: string | null;
    }[] = [];

    let lastPrice = 0;

    for (const r of usable) {
      const side = safeSide(r.side);
      const px = Number(r.price ?? 0);
      const base = Number(r.base_size ?? 0);
      const quote = Number(r.quote_size ?? 0);
      const t = cleanString(r.created_at) || nowIso();

      // last seen price for open pnl (best effort)
      if (Number.isFinite(px) && px > 0) lastPrice = px;

      // derive missing base/price if possible
      let effBase = Number.isFinite(base) && base > 0 ? base : 0;
      let effPrice = Number.isFinite(px) && px > 0 ? px : 0;

      if (!effBase && quote > 0 && effPrice > 0) effBase = quote / effPrice;
      if (!effPrice && quote > 0 && effBase > 0) effPrice = quote / effBase;

      if (!Number.isFinite(effBase) || effBase <= 0) continue;
      if (!Number.isFinite(effPrice) || effPrice <= 0) continue;

      if (side === "BUY") {
        buys.push({ qty: effBase, price: effPrice, time: t, order_id: r.order_id });
        continue;
      }

      // SELL: match against buys FIFO
      let sellQty = effBase;

      while (sellQty > 0 && buys.length > 0) {
        const lot = buys[0];
        const matched = Math.min(sellQty, lot.qty);

        const entryPrice = lot.price;
        const exitPrice = effPrice;

        const pnlUsd = (exitPrice - entryPrice) * matched;
        const pnlBps = bps(exitPrice, entryPrice);

        realizedTrades.push({
          time: t,
          entry_price: entryPrice,
          exit_price: exitPrice,
          qty: matched,
          pnl_usd: pnlUsd,
          pnl_bps: pnlBps,
          entry_order_id: lot.order_id ?? null,
          exit_order_id: r.order_id ?? null,
        });

        lot.qty -= matched;
        sellQty -= matched;

        if (lot.qty <= 1e-12) buys.shift();
      }

      // If we sold more than we have (shouldn’t happen), we ignore remainder.
    }

    // Realized summary
    const realizedPnL = realizedTrades.reduce((s, x) => s + (Number(x.pnl_usd) || 0), 0);

    const wins = realizedTrades.filter((x) => x.pnl_usd > 0);
    const losses = realizedTrades.filter((x) => x.pnl_usd < 0);

    const avgWinBps = wins.length
      ? wins.reduce((s, x) => s + (Number(x.pnl_bps) || 0), 0) / wins.length
      : 0;

    const avgLossBps = losses.length
      ? losses.reduce((s, x) => s + (Number(x.pnl_bps) || 0), 0) / losses.length
      : 0;

    const winRate = realizedTrades.length ? (wins.length / realizedTrades.length) * 100 : 0;

    // Open position from remaining BUY lots
    const openBase = buys.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const openCostUsd = buys.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const openAvgPrice = openBase > 0 ? openCostUsd / openBase : 0;

    // Open PnL best effort (needs lastPrice)
    const openPnlUsd =
      openBase > 0 && lastPrice > 0 ? (lastPrice - openAvgPrice) * openBase : 0;

    // Simple “equity” curve from start equity env + realized pnl (best effort)
    const startEquity = num(process.env.YC_START_EQUITY_USD, 0);
    const equityNow = startEquity + realizedPnL + openPnlUsd;

    // Max drawdown from equity series (we only have realized points; still useful)
    let peakEquity = startEquity;
    let maxDdPct = 0;
    let running = startEquity;

    // Walk realized events in time order
    const realizedByTime = [...realizedTrades].sort((a, b) => (a.time < b.time ? -1 : 1));
    for (const x of realizedByTime) {
      running += Number(x.pnl_usd) || 0;
      if (running > peakEquity) peakEquity = running;
      const dd = peakEquity > 0 ? ((peakEquity - running) / peakEquity) * 100 : 0;
      if (dd > maxDdPct) maxDdPct = dd;
    }

    return json(200, {
      ok: true,
      runId,
      since,
      symbol,
      user_id: user_id || null,

      // ingestion
      rows_scanned: rows.length,
      rows_usable: usable.length,
      limit,

      // realized
      total_trades: realizedTrades.length,
      wins: wins.length,
      losses: losses.length,
      win_rate: round2(winRate),
      avg_win_bps: round2(avgWinBps),
      avg_loss_bps: round2(avgLossBps),
      net_realized_pnl_usd: round2(realizedPnL),

      // open
      open_position_base: round4(openBase),
      open_cost_usd: round2(openCostUsd),
      spot_price: lastPrice ? round2(lastPrice) : null,
      open_avg_price: openAvgPrice ? round2(openAvgPrice) : null,
      current_open_pnl_usd: round2(openPnlUsd),

      // equity-ish (best effort)
      starting_equity_usd: round2(startEquity),
      running_equity_usd: round2(equityNow),
      max_drawdown_pct: round2(maxDdPct),

      // debug helpers
      debug: {
        only_user_id_env: (process.env.PULSE_ONLY_USER_ID || "").trim() || null,
        note:
          "PnL uses FIFO matching on trade_logs. Needs base_size + price for best accuracy. Open PnL uses last seen trade price from logs (best-effort).",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}

export async function POST(req: Request) {
  // POST just proxies to GET behavior (same auth, same params)
  return GET(req);
}