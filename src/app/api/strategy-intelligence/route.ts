// src/app/api/strategy-intelligence/route.ts
// Read-only Strategy Intelligence powered by completed_trades truth layer
// Filters out malformed / absurd rows so Mission Control stays honest.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_REASONABLE_ABS_BPS = 2000; // 20.00%
const MAX_REASONABLE_HOLD_MINUTES = 60 * 24 * 7; // 7 days

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function n(x: any): number {
  const v =
    typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(v) ? v : NaN;
}

function isFiniteNumber(x: any): boolean {
  return Number.isFinite(n(x));
}

type CompletedTradeRow = {
  id?: string | number;
  user_id?: string | null;
  bot?: string | null;
  symbol?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  pnl_usd?: number | string | null;
  pnl_bps?: number | string | null;
  hold_minutes?: number | string | null;
  total_buy_size?: number | string | null;
  total_sell_size?: number | string | null;
  buy_notional?: number | string | null;
  sell_notional?: number | string | null;
};

type UsableTradeOk = {
  ok: true;
  pnlUsd: number;
  pnlBps: number;
  holdMinutes: number;
};

type UsableTradeBad = {
  ok: false;
  reason: string;
};

function isUsableTrade(row: CompletedTradeRow): UsableTradeOk | UsableTradeBad {
  const pnlUsd = n(row.pnl_usd);
  const pnlBps = n(row.pnl_bps);
  const holdMinutes = n(row.hold_minutes);
  const entryPrice = n(row.entry_price);
  const exitPrice = n(row.exit_price);

  if (!isFiniteNumber(row.pnl_usd)) {
    return { ok: false, reason: "missing_pnl_usd" };
  }

  if (!isFiniteNumber(row.pnl_bps)) {
    return { ok: false, reason: "missing_pnl_bps" };
  }

  if (!isFiniteNumber(row.hold_minutes)) {
    return { ok: false, reason: "missing_hold_minutes" };
  }

  if (!isFiniteNumber(row.entry_price) || entryPrice <= 0) {
    return { ok: false, reason: "bad_entry_price" };
  }

  if (!isFiniteNumber(row.exit_price) || exitPrice <= 0) {
    return { ok: false, reason: "bad_exit_price" };
  }

  if (!row.exit_time) {
    return { ok: false, reason: "missing_exit_time" };
  }

  if (holdMinutes < 0 || holdMinutes > MAX_REASONABLE_HOLD_MINUTES) {
    return { ok: false, reason: "bad_hold_minutes" };
  }

  if (Math.abs(pnlBps) > MAX_REASONABLE_ABS_BPS) {
    return { ok: false, reason: "absurd_pnl_bps" };
  }

  return {
    ok: true,
    pnlUsd,
    pnlBps,
    holdMinutes,
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

    const { data, error } = await supabase
      .from("completed_trades")
      .select("*")
      .order("exit_time", { ascending: false });

    if (error) {
      return json(200, {
        ok: false,
        status: "STRATEGY_INTELLIGENCE_QUERY_ERROR",
        error: error.message,
      });
    }

    const fetchedTrades: CompletedTradeRow[] = Array.isArray(data) ? data : [];

    let wins = 0;
    let losses = 0;

    let totalBps = 0;
    let totalWinBps = 0;
    let totalLossBpsAbs = 0;

    let totalHoldMinutes = 0;
    let profitableHolds = 0;
    let unprofitableHolds = 0;

    let rowsUsed = 0;
    let rowsExcluded = 0;

    const exclusionReasons: Record<string, number> = {};

    for (const trade of fetchedTrades) {
      const usable = isUsableTrade(trade);

      if (!usable.ok) {
        rowsExcluded++;
        const reason = usable.reason;
        exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1;
        continue;
      }

      rowsUsed++;

      const pnlUsd = usable.pnlUsd;
      const pnlBps = usable.pnlBps;
      const holdMinutes = usable.holdMinutes;

      totalBps += pnlBps;
      totalHoldMinutes += holdMinutes;

      if (pnlUsd > 0) {
        wins++;
        profitableHolds++;
        totalWinBps += pnlBps;
      } else if (pnlUsd < 0) {
        losses++;
        unprofitableHolds++;
        totalLossBpsAbs += Math.abs(pnlBps);
      }
    }

    const decisionsAnalyzed = rowsUsed;

    const avgOutcome30mBps =
      decisionsAnalyzed > 0 ? totalBps / decisionsAnalyzed : 0;

    const avgOutcome60mBps = wins > 0 ? totalWinBps / wins : 0;

    const winRatePct =
      decisionsAnalyzed > 0 ? (wins / decisionsAnalyzed) * 100 : 0;

    const lossRatePct =
      decisionsAnalyzed > 0 ? (losses / decisionsAnalyzed) * 100 : 0;

    const holdQualityPct =
      decisionsAnalyzed > 0 ? (profitableHolds / decisionsAnalyzed) * 100 : 0;

    const exitTimingQualityPct =
      decisionsAnalyzed > 0 ? (profitableHolds / decisionsAnalyzed) * 100 : 0;

    const avgLossBps = losses > 0 ? totalLossBpsAbs / losses : 0;

    const avgHoldMinutes =
      decisionsAnalyzed > 0 ? totalHoldMinutes / decisionsAnalyzed : 0;

    return json(200, {
      ok: true,
      status: "STRATEGY_INTELLIGENCE_READY",
      source: "completed_trades_sane_rows",
      decisionsAnalyzed,

      averages: {
        avgOutcome30mBps: Number(avgOutcome30mBps.toFixed(2)),
        avgOutcome60mBps: Number(avgOutcome60mBps.toFixed(2)),
      },

      entry: {
        total: decisionsAnalyzed,
        allowed: decisionsAnalyzed,
        blocked: 0,
        allowedPct: decisionsAnalyzed > 0 ? 100 : 0,
        blockedPct: 0,
        wins,
        losses,
        missedWins: 0,
        goodBlocks: 0,
        winRatePct: Number(winRatePct.toFixed(2)),
        lossRatePct: Number(lossRatePct.toFixed(2)),
      },

      exit: {
        holdCount: decisionsAnalyzed,
        exitSignalCount: decisionsAnalyzed,
        goodHolds: profitableHolds,
        badHolds: unprofitableHolds,
        earlyExits: 0,
        goodExits: profitableHolds,
        holdQualityPct: Number(holdQualityPct.toFixed(2)),
        exitTimingQualityPct: Number(exitTimingQualityPct.toFixed(2)),
      },

      meta: {
        avgLossBps: Number(avgLossBps.toFixed(2)),
        avgHoldMinutes: Number(avgHoldMinutes.toFixed(2)),
        rowsFetched: fetchedTrades.length,
        rowsUsed,
        rowsExcluded,
        exclusionReasons,
        maxReasonableAbsBps: MAX_REASONABLE_ABS_BPS,
        note: "Strategy Intelligence is aligned to completed round-trip trades with sanity filtering.",
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
