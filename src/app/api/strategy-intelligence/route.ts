// src/app/api/strategy-intelligence/route.ts
// Read-only Strategy Intelligence powered by completed_trades truth layer

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

    const trades = Array.isArray(data) ? data : [];

    const decisionsAnalyzed = trades.length;

    let wins = 0;
    let losses = 0;

    let totalBps = 0;
    let totalWinBps = 0;
    let totalLossBpsAbs = 0;

    let totalHoldMinutes = 0;
    let profitableHolds = 0;
    let unprofitableHolds = 0;

    for (const t of trades) {
      const pnlUsd = n((t as any).pnl_usd);
      const pnlBps = n((t as any).pnl_bps);
      const holdMinutes = n((t as any).hold_minutes);

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

    const avgOutcome30mBps =
      decisionsAnalyzed > 0 ? totalBps / decisionsAnalyzed : 0;

    const avgOutcome60mBps =
      wins > 0 ? totalWinBps / wins : 0;

    const winRatePct =
      decisionsAnalyzed > 0 ? (wins / decisionsAnalyzed) * 100 : 0;

    const lossRatePct =
      decisionsAnalyzed > 0 ? (losses / decisionsAnalyzed) * 100 : 0;

    const holdQualityPct =
      decisionsAnalyzed > 0 ? (profitableHolds / decisionsAnalyzed) * 100 : 0;

    const exitTimingQualityPct = holdQualityPct;

    const avgLossBps =
      losses > 0 ? totalLossBpsAbs / losses : 0;

    const avgHoldMinutes =
      decisionsAnalyzed > 0 ? totalHoldMinutes / decisionsAnalyzed : 0;

    return json(200, {
      ok: true,
      status: "STRATEGY_INTELLIGENCE_READY",
      source: "completed_trades",

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
        note: "Strategy Intelligence is now aligned to completed round-trip trades.",
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