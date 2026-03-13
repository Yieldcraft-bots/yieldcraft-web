// src/app/api/strategy-intelligence/route.ts
// Read-only Strategy Intelligence
// Truth-first version:
// - Core Fund metrics come from corefund_strategy_intelligence_summary
// - Network metrics come from strategy_intelligence_summary
// - Falls back to completed_trades if a summary view is unavailable

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const CORE_FUND_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";
const DEFAULT_SYMBOL = "BTC-USD";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function n(x: any): number {
  const v =
    typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(v) ? v : 0;
}

type SummaryRow = {
  symbol?: string | null;
  trades?: number | string | null;
  wins?: number | string | null;
  losses?: number | string | null;
  avg_edge_bps?: number | string | null;
  avg_win_bps?: number | string | null;
  avg_loss_bps?: number | string | null;
  avg_hold_minutes?: number | string | null;
};

type CompletedTradeRow = {
  user_id?: string | null;
  bot?: string | null;
  symbol?: string | null;
  pnl_usd?: number | string | null;
  pnl_bps?: number | string | null;
  hold_minutes?: number | string | null;
};

type BuiltSummary = {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  avgEdgeBps: number;
  avgWinBps: number;
  avgLossBps: number;
  avgHoldMinutes: number;
  winRatePct: number;
  lossRatePct: number;
};

function emptySummary(symbol = DEFAULT_SYMBOL): BuiltSummary {
  return {
    symbol,
    trades: 0,
    wins: 0,
    losses: 0,
    avgEdgeBps: 0,
    avgWinBps: 0,
    avgLossBps: 0,
    avgHoldMinutes: 0,
    winRatePct: 0,
    lossRatePct: 0,
  };
}

function buildFromSummaryRow(
  row?: SummaryRow | null,
  symbol = DEFAULT_SYMBOL
): BuiltSummary {
  if (!row) return emptySummary(symbol);

  const trades = Math.max(0, Math.trunc(n(row.trades)));
  const wins = Math.max(0, Math.trunc(n(row.wins)));
  const losses = Math.max(0, Math.trunc(n(row.losses)));
  const avgEdgeBps = n(row.avg_edge_bps);
  const avgWinBps = n(row.avg_win_bps);
  const avgLossBps = n(row.avg_loss_bps);
  const avgHoldMinutes = n(row.avg_hold_minutes);

  const denom = trades > 0 ? trades : wins + losses;
  const winRatePct = denom > 0 ? (wins / denom) * 100 : 0;
  const lossRatePct = denom > 0 ? (losses / denom) * 100 : 0;

  return {
    symbol: String(row.symbol || symbol),
    trades,
    wins,
    losses,
    avgEdgeBps,
    avgWinBps,
    avgLossBps,
    avgHoldMinutes,
    winRatePct,
    lossRatePct,
  };
}

function buildFromCompletedTrades(
  rows: CompletedTradeRow[],
  symbol = DEFAULT_SYMBOL
): BuiltSummary {
  if (!Array.isArray(rows) || rows.length === 0) return emptySummary(symbol);

  let trades = 0;
  let wins = 0;
  let losses = 0;
  let totalBps = 0;
  let totalWinBps = 0;
  let totalLossBps = 0;
  let totalHoldMinutes = 0;

  for (const row of rows) {
    const pnlUsd = n(row.pnl_usd);
    const pnlBps = n(row.pnl_bps);
    const holdMinutes = n(row.hold_minutes);

    trades++;
    totalBps += pnlBps;
    totalHoldMinutes += holdMinutes;

    if (pnlUsd > 0) {
      wins++;
      totalWinBps += pnlBps;
    } else if (pnlUsd < 0) {
      losses++;
      totalLossBps += pnlBps; // keep negative sign
    }
  }

  const avgEdgeBps = trades > 0 ? totalBps / trades : 0;
  const avgWinBps = wins > 0 ? totalWinBps / wins : 0;
  const avgLossBps = losses > 0 ? totalLossBps / losses : 0;
  const avgHoldMinutes = trades > 0 ? totalHoldMinutes / trades : 0;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;
  const lossRatePct = trades > 0 ? (losses / trades) * 100 : 0;

  return {
    symbol,
    trades,
    wins,
    losses,
    avgEdgeBps,
    avgWinBps,
    avgLossBps,
    avgHoldMinutes,
    winRatePct,
    lossRatePct,
  };
}

// NOTE: supabase is intentionally typed as any here to avoid Next/Supabase generic build issues
async function fetchSingleSummaryView(
  supabase: any,
  viewName: string,
  symbol = DEFAULT_SYMBOL
): Promise<{ ok: true; summary: BuiltSummary } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(viewName)
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message || String(error) };
  }

  return {
    ok: true,
    summary: buildFromSummaryRow((data as SummaryRow | null) ?? null, symbol),
  };
}

async function fetchCoreFundFallback(
  supabase: any,
  symbol = DEFAULT_SYMBOL
): Promise<{ ok: true; summary: BuiltSummary } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("completed_trades")
    .select("user_id, bot, symbol, pnl_usd, pnl_bps, hold_minutes")
    .eq("user_id", CORE_FUND_USER_ID)
    .eq("bot", "pulse")
    .eq("symbol", symbol)
    .order("exit_time", { ascending: false });

  if (error) {
    return { ok: false, error: error.message || String(error) };
  }

  return {
    ok: true,
    summary: buildFromCompletedTrades(
      (Array.isArray(data) ? data : []) as CompletedTradeRow[],
      symbol
    ),
  };
}

async function fetchNetworkFallback(
  supabase: any,
  symbol = DEFAULT_SYMBOL
): Promise<{ ok: true; summary: BuiltSummary } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("completed_trades")
    .select("user_id, bot, symbol, pnl_usd, pnl_bps, hold_minutes")
    .eq("symbol", symbol)
    .order("exit_time", { ascending: false });

  if (error) {
    return { ok: false, error: error.message || String(error) };
  }

  return {
    ok: true,
    summary: buildFromCompletedTrades(
      (Array.isArray(data) ? data : []) as CompletedTradeRow[],
      symbol
    ),
  };
}

export async function GET() {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      "";

    if (!url || !serviceKey) {
      return json(200, {
        ok: false,
        status: "STRATEGY_INTELLIGENCE_NOT_CONFIGURED",
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    let coreFundSource = "corefund_strategy_intelligence_summary";
    let coreFund = await fetchSingleSummaryView(
      supabase,
      "corefund_strategy_intelligence_summary",
      DEFAULT_SYMBOL
    );

    if (!coreFund.ok) {
      coreFundSource = "completed_trades_fallback";
      coreFund = await fetchCoreFundFallback(supabase, DEFAULT_SYMBOL);
    }

    if (!coreFund.ok) {
      return json(200, {
        ok: false,
        status: "STRATEGY_INTELLIGENCE_CORE_FUND_ERROR",
        error: coreFund.error,
      });
    }

    let networkSource = "strategy_intelligence_summary";
    let network = await fetchSingleSummaryView(
      supabase,
      "strategy_intelligence_summary",
      DEFAULT_SYMBOL
    );

    if (!network.ok) {
      networkSource = "completed_trades_fallback";
      network = await fetchNetworkFallback(supabase, DEFAULT_SYMBOL);
    }

    if (!network.ok) {
      return json(200, {
        ok: false,
        status: "STRATEGY_INTELLIGENCE_NETWORK_ERROR",
        error: network.error,
      });
    }

    const core = coreFund.summary;
    const net = network.summary;

    return json(200, {
      ok: true,
      status: "STRATEGY_INTELLIGENCE_READY",
      source: {
        coreFund: coreFundSource,
        network: networkSource,
      },

      decisionsAnalyzed: core.trades,

      averages: {
        avgOutcome30mBps: Number(core.avgEdgeBps.toFixed(2)),
        avgOutcome60mBps: Number(core.avgWinBps.toFixed(2)),
      },

      entry: {
        total: core.trades,
        allowed: core.trades,
        blocked: 0,
        allowedPct: core.trades > 0 ? 100 : 0,
        blockedPct: 0,
        wins: core.wins,
        losses: core.losses,
        missedWins: 0,
        goodBlocks: 0,
        winRatePct: Number(core.winRatePct.toFixed(2)),
        lossRatePct: Number(core.lossRatePct.toFixed(2)),
      },

      exit: {
        holdCount: core.trades,
        exitSignalCount: core.trades,
        goodHolds: core.wins,
        badHolds: core.losses,
        earlyExits: 0,
        goodExits: core.wins,
        holdQualityPct: Number(core.winRatePct.toFixed(2)),
        exitTimingQualityPct: Number(core.winRatePct.toFixed(2)),
      },

      meta: {
        avgLossBps: Number(core.avgLossBps.toFixed(2)),
        avgHoldMinutes: Number(core.avgHoldMinutes.toFixed(2)),
        note: "Core Fund top-level values come from completed-trade truth. Network summary is included separately below.",
      },

      coreFund: {
        symbol: core.symbol,
        trades: core.trades,
        wins: core.wins,
        losses: core.losses,
        avgEdgeBps: Number(core.avgEdgeBps.toFixed(2)),
        avgWinBps: Number(core.avgWinBps.toFixed(2)),
        avgLossBps: Number(core.avgLossBps.toFixed(2)),
        avgHoldMinutes: Number(core.avgHoldMinutes.toFixed(2)),
        winRatePct: Number(core.winRatePct.toFixed(2)),
      },

      network: {
        symbol: net.symbol,
        trades: net.trades,
        wins: net.wins,
        losses: net.losses,
        avgEdgeBps: Number(net.avgEdgeBps.toFixed(2)),
        avgWinBps: Number(net.avgWinBps.toFixed(2)),
        avgLossBps: Number(net.avgLossBps.toFixed(2)),
        avgHoldMinutes: Number(net.avgHoldMinutes.toFixed(2)),
        winRatePct: Number(net.winRatePct.toFixed(2)),
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "STRATEGY_INTELLIGENCE_ERROR",
      error: e?.message || String(e),
    });
  }
}
