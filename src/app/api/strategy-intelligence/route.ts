import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type StrategyDecisionRow = {
  id: string;
  created_at: string;
  action_phase: string | null;
  decision_mode: string | null;
  decision_reason: string | null;
  market_regime: string | null;
  recon_confidence: number | null;
  outcome_status: string | null;
  outcome_5m_bps: number | null;
  outcome_15m_bps: number | null;
  outcome_30m_bps: number | null;
  outcome_60m_bps: number | null;
  best_outcome_bps: number | null;
  worst_outcome_bps: number | null;
};

function safe(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function avg(sum: number, count: number) {
  if (!count) return 0;
  return sum / count;
}

function toRow(raw: any): StrategyDecisionRow {
  return {
    id: String(raw?.id ?? ""),
    created_at: String(raw?.created_at ?? ""),
    action_phase: raw?.action_phase ?? null,
    decision_mode: raw?.decision_mode ?? null,
    decision_reason: raw?.decision_reason ?? null,
    market_regime: raw?.market_regime ?? null,
    recon_confidence:
      raw?.recon_confidence === null || raw?.recon_confidence === undefined
        ? null
        : Number(raw.recon_confidence),
    outcome_status: raw?.outcome_status ?? null,
    outcome_5m_bps:
      raw?.outcome_5m_bps === null || raw?.outcome_5m_bps === undefined
        ? null
        : Number(raw.outcome_5m_bps),
    outcome_15m_bps:
      raw?.outcome_15m_bps === null || raw?.outcome_15m_bps === undefined
        ? null
        : Number(raw.outcome_15m_bps),
    outcome_30m_bps:
      raw?.outcome_30m_bps === null || raw?.outcome_30m_bps === undefined
        ? null
        : Number(raw.outcome_30m_bps),
    outcome_60m_bps:
      raw?.outcome_60m_bps === null || raw?.outcome_60m_bps === undefined
        ? null
        : Number(raw.outcome_60m_bps),
    best_outcome_bps:
      raw?.best_outcome_bps === null || raw?.best_outcome_bps === undefined
        ? null
        : Number(raw.best_outcome_bps),
    worst_outcome_bps:
      raw?.worst_outcome_bps === null || raw?.worst_outcome_bps === undefined
        ? null
        : Number(raw.worst_outcome_bps),
  };
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("strategy_decisions")
      .select(
        [
          "id",
          "created_at",
          "action_phase",
          "decision_mode",
          "decision_reason",
          "market_regime",
          "recon_confidence",
          "outcome_status",
          "outcome_5m_bps",
          "outcome_15m_bps",
          "outcome_30m_bps",
          "outcome_60m_bps",
          "best_outcome_bps",
          "worst_outcome_bps",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    const rows = Array.isArray(data) ? data.map(toRow) : [];

    let entryAllowedCount = 0;
    let entryBlockedCount = 0;
    let entryWinCount = 0;
    let entryLossCount = 0;
    let entryMissedWinCount = 0;
    let entryGoodBlockCount = 0;

    let exitHoldCount = 0;
    let exitSignalCount = 0;
    let exitGoodHoldCount = 0;
    let exitBadHoldCount = 0;
    let exitEarlyExitCount = 0;
    let exitGoodExitCount = 0;

    let totalOutcome30m = 0;
    let totalOutcome60m = 0;
    let outcome30mCount = 0;
    let outcome60mCount = 0;

    const regimeMap: Record<
      string,
      {
        total: number;
        wins: number;
        losses: number;
        missedWins: number;
        goodBlocks: number;
        goodHolds: number;
        badHolds: number;
        earlyExits: number;
        goodExits: number;
      }
    > = {};

    const confidenceBuckets: Record<
      string,
      {
        total: number;
        wins: number;
        losses: number;
        avg30mBpsSum: number;
        avg30mBpsCount: number;
      }
    > = {
      "<0.60": { total: 0, wins: 0, losses: 0, avg30mBpsSum: 0, avg30mBpsCount: 0 },
      "0.60-0.69": { total: 0, wins: 0, losses: 0, avg30mBpsSum: 0, avg30mBpsCount: 0 },
      "0.70-0.79": { total: 0, wins: 0, losses: 0, avg30mBpsSum: 0, avg30mBpsCount: 0 },
      "0.80+": { total: 0, wins: 0, losses: 0, avg30mBpsSum: 0, avg30mBpsCount: 0 },
      unknown: { total: 0, wins: 0, losses: 0, avg30mBpsSum: 0, avg30mBpsCount: 0 },
    };

    for (const row of rows) {
      const actionPhase = String(row.action_phase || "").toUpperCase();
      const decisionMode = String(row.decision_mode || "").toLowerCase();
      const outcomeStatus = String(row.outcome_status || "").toUpperCase();
      const regime = String(row.market_regime || "UNKNOWN").toUpperCase();

      const reconConfidence = row.recon_confidence;
      const outcome30m = row.outcome_30m_bps === null ? null : safe(row.outcome_30m_bps);
      const outcome60m = row.outcome_60m_bps === null ? null : safe(row.outcome_60m_bps);

      if (!regimeMap[regime]) {
        regimeMap[regime] = {
          total: 0,
          wins: 0,
          losses: 0,
          missedWins: 0,
          goodBlocks: 0,
          goodHolds: 0,
          badHolds: 0,
          earlyExits: 0,
          goodExits: 0,
        };
      }

      regimeMap[regime].total += 1;

      if (outcome30m !== null) {
        totalOutcome30m += outcome30m;
        outcome30mCount += 1;
      }

      if (outcome60m !== null) {
        totalOutcome60m += outcome60m;
        outcome60mCount += 1;
      }

      let confidenceBucket = "unknown";
      if (reconConfidence !== null && Number.isFinite(reconConfidence)) {
        if (reconConfidence < 0.6) confidenceBucket = "<0.60";
        else if (reconConfidence < 0.7) confidenceBucket = "0.60-0.69";
        else if (reconConfidence < 0.8) confidenceBucket = "0.70-0.79";
        else confidenceBucket = "0.80+";
      }

      confidenceBuckets[confidenceBucket].total += 1;
      if (outcome30m !== null) {
        confidenceBuckets[confidenceBucket].avg30mBpsSum += outcome30m;
        confidenceBuckets[confidenceBucket].avg30mBpsCount += 1;
      }

      if (actionPhase === "ENTRY") {
        if (decisionMode === "allowed") {
          entryAllowedCount += 1;
        } else if (decisionMode === "blocked") {
          entryBlockedCount += 1;
        }

        if (outcomeStatus === "WIN" || outcomeStatus === "WIN_LIGHT") {
          entryWinCount += 1;
          regimeMap[regime].wins += 1;
          confidenceBuckets[confidenceBucket].wins += 1;
        }

        if (outcomeStatus === "LOSS" || outcomeStatus === "LOSS_LIGHT") {
          entryLossCount += 1;
          regimeMap[regime].losses += 1;
          confidenceBuckets[confidenceBucket].losses += 1;
        }

        if (outcomeStatus === "MISSED_WIN" || outcomeStatus === "MISSED_WIN_LIGHT") {
          entryMissedWinCount += 1;
          regimeMap[regime].missedWins += 1;
        }

        if (outcomeStatus === "GOOD_BLOCK" || outcomeStatus === "GOOD_BLOCK_LIGHT") {
          entryGoodBlockCount += 1;
          regimeMap[regime].goodBlocks += 1;
        }
      }

      if (actionPhase === "EXIT") {
        if (decisionMode === "hold") {
          exitHoldCount += 1;
        } else if (decisionMode === "exit_signal") {
          exitSignalCount += 1;
        }

        if (outcomeStatus === "GOOD_HOLD" || outcomeStatus === "GOOD_HOLD_LIGHT") {
          exitGoodHoldCount += 1;
          regimeMap[regime].goodHolds += 1;
        }

        if (outcomeStatus === "BAD_HOLD" || outcomeStatus === "BAD_HOLD_LIGHT") {
          exitBadHoldCount += 1;
          regimeMap[regime].badHolds += 1;
        }

        if (outcomeStatus === "EARLY_EXIT" || outcomeStatus === "EARLY_EXIT_LIGHT") {
          exitEarlyExitCount += 1;
          regimeMap[regime].earlyExits += 1;
        }

        if (outcomeStatus === "GOOD_EXIT" || outcomeStatus === "GOOD_EXIT_LIGHT") {
          exitGoodExitCount += 1;
          regimeMap[regime].goodExits += 1;
        }
      }
    }

    const entryTotal = entryAllowedCount + entryBlockedCount;
    const entryResolved = entryWinCount + entryLossCount;
    const exitResolvedHold = exitGoodHoldCount + exitBadHoldCount;
    const exitResolvedSignal = exitEarlyExitCount + exitGoodExitCount;

    const confidenceSummary = Object.entries(confidenceBuckets).map(([bucket, stats]) => ({
      bucket,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRatePct: Number(pct(stats.wins, stats.wins + stats.losses).toFixed(2)),
      avg30mBps: Number(avg(stats.avg30mBpsSum, stats.avg30mBpsCount).toFixed(2)),
    }));

    const regimeSummary = Object.entries(regimeMap)
      .map(([regime, stats]) => ({
        regime,
        total: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        missedWins: stats.missedWins,
        goodBlocks: stats.goodBlocks,
        goodHolds: stats.goodHolds,
        badHolds: stats.badHolds,
        earlyExits: stats.earlyExits,
        goodExits: stats.goodExits,
        entryWinRatePct: Number(pct(stats.wins, stats.wins + stats.losses).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      decisionsAnalyzed: rows.length,

      averages: {
        avgOutcome30mBps: Number(avg(totalOutcome30m, outcome30mCount).toFixed(2)),
        avgOutcome60mBps: Number(avg(totalOutcome60m, outcome60mCount).toFixed(2)),
      },

      entry: {
        total: entryTotal,
        allowed: entryAllowedCount,
        blocked: entryBlockedCount,
        allowedPct: Number(pct(entryAllowedCount, entryTotal).toFixed(2)),
        blockedPct: Number(pct(entryBlockedCount, entryTotal).toFixed(2)),
        wins: entryWinCount,
        losses: entryLossCount,
        missedWins: entryMissedWinCount,
        goodBlocks: entryGoodBlockCount,
        winRatePct: Number(pct(entryWinCount, entryResolved).toFixed(2)),
        lossRatePct: Number(pct(entryLossCount, entryResolved).toFixed(2)),
      },

      exit: {
        holdCount: exitHoldCount,
        exitSignalCount: exitSignalCount,
        goodHolds: exitGoodHoldCount,
        badHolds: exitBadHoldCount,
        earlyExits: exitEarlyExitCount,
        goodExits: exitGoodExitCount,
        holdQualityPct: Number(pct(exitGoodHoldCount, exitResolvedHold).toFixed(2)),
        exitTimingQualityPct: Number(pct(exitGoodExitCount, exitResolvedSignal).toFixed(2)),
      },

      confidenceSummary,
      regimeSummary,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: String(err),
    });
  }
}