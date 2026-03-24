import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type TradeRow = {
  id?: string;
  user_id?: string | null;
  created_at: string;
  side: "BUY" | "SELL";
  price?: string | number | null;
  base_size?: string | number | null;
  quote_size?: string | number | null;
  mode?: string | null;
  reason?: string | null;
};

type DecisionRow = {
  id?: string;
  user_id?: string | null;
  created_at: string;
  market_regime?: string | null;
  recon_confidence?: string | number | null;
  decision_mode?: string | null;
  decision_reason?: string | null;
  action_phase?: string | null;
};

type ClosedTrade = {
  user_id: string;
  entry_at: string;
  exit_at: string;
  held_minutes: number;
  entry_price: number;
  exit_price: number;
  base_size: number;
  quote_entry: number;
  quote_exit: number;
  gross_pnl_usd: number;
  gross_bps: number;
  entry_mode: string;
  exit_reason: string;
  regime: string;
  confidence_bucket: string;
  confidence: number | null;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeUpper(v: unknown, fallback = "UNKNOWN"): string {
  const s = String(v ?? "").trim();
  return s ? s.toUpperCase() : fallback;
}

function confidenceBucket(conf: number | null): string {
  if (conf === null || !Number.isFinite(conf)) return "unknown";
  if (conf < 0.60) return "lt_0.60";
  if (conf < 0.68) return "0.60_0.67";
  if (conf < 0.72) return "0.68_0.71";
  if (conf < 0.80) return "0.72_0.79";
  return "gte_0.80";
}

function round(n: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function summarize<T extends string>(rows: ClosedTrade[], key: (r: ClosedTrade) => T) {
  const map = new Map<
    T,
    {
      trades: number;
      wins: number;
      losses: number;
      gross_pnl_usd: number;
      avg_edge_bps: number;
      avg_win_bps: number;
      avg_loss_bps: number;
      hard_stops: number;
      trail_stops: number;
    }
  >();

  const temp = new Map<
    T,
    {
      trades: number;
      wins: number;
      losses: number;
      gross_pnl_usd: number;
      gross_bps_sum: number;
      win_bps_sum: number;
      loss_bps_sum: number;
      hard_stops: number;
      trail_stops: number;
    }
  >();

  for (const row of rows) {
    const k = key(row);
    const current = temp.get(k) ?? {
      trades: 0,
      wins: 0,
      losses: 0,
      gross_pnl_usd: 0,
      gross_bps_sum: 0,
      win_bps_sum: 0,
      loss_bps_sum: 0,
      hard_stops: 0,
      trail_stops: 0,
    };

    current.trades += 1;
    current.gross_pnl_usd += row.gross_pnl_usd;
    current.gross_bps_sum += row.gross_bps;

    if (row.gross_bps >= 0) {
      current.wins += 1;
      current.win_bps_sum += row.gross_bps;
    } else {
      current.losses += 1;
      current.loss_bps_sum += row.gross_bps;
    }

    if (row.exit_reason === "hard_stop") current.hard_stops += 1;
    if (row.exit_reason === "trail_stop") current.trail_stops += 1;

    temp.set(k, current);
  }

  for (const [k, v] of temp.entries()) {
    map.set(k, {
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      gross_pnl_usd: round(v.gross_pnl_usd, 4),
      avg_edge_bps: round(v.gross_bps_sum / Math.max(v.trades, 1), 2),
      avg_win_bps: round(v.win_bps_sum / Math.max(v.wins, 1), 2),
      avg_loss_bps: round(v.loss_bps_sum / Math.max(v.losses, 1), 2),
      hard_stops: v.hard_stops,
      trail_stops: v.trail_stops,
    });
  }

  return Object.fromEntries(
    Array.from(map.entries()).sort((a, b) => b[1].trades - a[1].trades)
  );
}

function pairClosedTrades(trades: TradeRow[], decisions: DecisionRow[]): ClosedTrade[] {
  const byUser = new Map<string, TradeRow[]>();
  for (const row of trades) {
    const userId = row.user_id ?? "unknown";
    const arr = byUser.get(userId) ?? [];
    arr.push(row);
    byUser.set(userId, arr);
  }

  const decisionByUser = new Map<string, DecisionRow[]>();
  for (const row of decisions) {
    const userId = row.user_id ?? "unknown";
    const arr = decisionByUser.get(userId) ?? [];
    arr.push(row);
    decisionByUser.set(userId, arr);
  }

  const closed: ClosedTrade[] = [];

  for (const [userId, userTrades] of byUser.entries()) {
    const sortedTrades = [...userTrades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const userDecisions = [...(decisionByUser.get(userId) ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let openBuy: TradeRow | null = null;

    for (const trade of sortedTrades) {
      if (trade.side === "BUY") {
        openBuy = trade;
        continue;
      }

      if (trade.side !== "SELL" || !openBuy) continue;

      const entryPrice = num(openBuy.price);
      const exitPrice = num(trade.price);
      const baseSize = Math.max(num(openBuy.base_size), num(trade.base_size));
      if (!entryPrice || !exitPrice || !baseSize) {
        openBuy = null;
        continue;
      }

      const entryTs = new Date(openBuy.created_at).getTime();
      const exitTs = new Date(trade.created_at).getTime();
      const nearestDecision = userDecisions
        .filter((d) => new Date(d.created_at).getTime() <= entryTs)
        .slice(-1)[0];

      const grossPnlUsd = (exitPrice - entryPrice) * baseSize;
      const grossBps = ((exitPrice - entryPrice) / entryPrice) * 10000;

      closed.push({
        user_id: userId,
        entry_at: openBuy.created_at,
        exit_at: trade.created_at,
        held_minutes: round((exitTs - entryTs) / 60000, 2),
        entry_price: entryPrice,
        exit_price: exitPrice,
        base_size: baseSize,
        quote_entry: num(openBuy.quote_size),
        quote_exit: num(trade.quote_size),
        gross_pnl_usd: round(grossPnlUsd, 6),
        gross_bps: round(grossBps, 2),
        entry_mode: String(openBuy.mode ?? "UNKNOWN"),
        exit_reason: String(trade.reason ?? "unknown"),
        regime: safeUpper(nearestDecision?.market_regime, "UNKNOWN"),
        confidence: nearestDecision?.recon_confidence == null ? null : num(nearestDecision.recon_confidence, NaN),
        confidence_bucket: confidenceBucket(
          nearestDecision?.recon_confidence == null ? null : num(nearestDecision.recon_confidence, NaN)
        ),
      });

      openBuy = null;
    }
  }

  return closed.sort(
    (a, b) => new Date(b.exit_at).getTime() - new Date(a.exit_at).getTime()
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lookback = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 250), 20), 1000);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ ok: false, error: "Missing Supabase envs" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: trades, error: tradesError } = await supabase
      .from("trade_logs")
      .select("id,user_id,created_at,side,price,base_size,quote_size,mode,reason")
      .in("side", ["BUY", "SELL"])
      .order("created_at", { ascending: false })
      .limit(lookback);

    if (tradesError) {
      return NextResponse.json({ ok: false, error: tradesError.message, source: "trade_logs" }, { status: 500 });
    }

    const minTradeTime = trades?.length
      ? [...trades].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.created_at
      : null;

    let decisions: DecisionRow[] = [];
    if (minTradeTime) {
      const { data: decisionData } = await supabase
        .from("strategy_decisions")
        .select("id,user_id,created_at,market_regime,recon_confidence,decision_mode,decision_reason,action_phase")
        .gte("created_at", minTradeTime)
        .order("created_at", { ascending: true })
        .limit(lookback * 3);

      decisions = decisionData ?? [];
    }

    const closedTrades = pairClosedTrades((trades ?? []).reverse(), decisions);

    const summary = {
      trades: closedTrades.length,
      wins: closedTrades.filter((t) => t.gross_bps >= 0).length,
      losses: closedTrades.filter((t) => t.gross_bps < 0).length,
      gross_pnl_usd: round(closedTrades.reduce((s, t) => s + t.gross_pnl_usd, 0), 6),
      avg_edge_bps: round(
        closedTrades.reduce((s, t) => s + t.gross_bps, 0) / Math.max(closedTrades.length, 1),
        2
      ),
      avg_win_bps: round(
        closedTrades.filter((t) => t.gross_bps >= 0).reduce((s, t) => s + t.gross_bps, 0) /
          Math.max(closedTrades.filter((t) => t.gross_bps >= 0).length, 1),
        2
      ),
      avg_loss_bps: round(
        closedTrades.filter((t) => t.gross_bps < 0).reduce((s, t) => s + t.gross_bps, 0) /
          Math.max(closedTrades.filter((t) => t.gross_bps < 0).length, 1),
        2
      ),
      hard_stops: closedTrades.filter((t) => t.exit_reason === "hard_stop").length,
      trail_stops: closedTrades.filter((t) => t.exit_reason === "trail_stop").length,
    };

    return NextResponse.json({
      ok: true,
      scope: "read_only_edge_engine",
      lookback,
      summary,
      by_entry_mode: summarize(closedTrades, (t) => t.entry_mode),
      by_regime: summarize(closedTrades, (t) => t.regime),
      by_confidence_bucket: summarize(closedTrades, (t) => t.confidence_bucket),
      recent_closed_trades: closedTrades.slice(0, 50),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
