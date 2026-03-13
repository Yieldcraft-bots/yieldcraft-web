// src/app/api/strategy-adjustments/route.ts
// Read-only strategy recommendation engine powered by completed_trades
// No trading side effects — advisory only.

import { NextRequest, NextResponse } from "next/server";
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

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      "";

    if (!url || !key) {
      return json(200, {
        ok: false,
        status: "SUPABASE_NOT_CONFIGURED",
      });
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const search = req.nextUrl.searchParams;
    const lookbackDaysRaw = n(search.get("days"));
    const lookbackDays =
      lookbackDaysRaw > 0 ? clamp(Math.floor(lookbackDaysRaw), 1, 30) : 7;

    const since = daysAgoISO(lookbackDays);

    const { data, error } = await supabase
      .from("completed_trades")
      .select("*")
      .gte("exit_time", since)
      .order("exit_time", { ascending: false });

    if (error) {
      return json(200, {
        ok: false,
        status: "COMPLETED_TRADES_FETCH_ERROR",
        error: error.message,
      });
    }

    const trades = Array.isArray(data) ? data : [];

    let wins = 0;
    let losses = 0;
    let totalTrades = 0;

    let winBpsSum = 0;
    let lossBpsSumAbs = 0;
    let netBpsSum = 0;

    let holdMinutesSum = 0;

    for (const t of trades) {
      const pnlUsd = n((t as any).pnl_usd);
      const pnlBps = n((t as any).pnl_bps);
      const holdMinutes = n((t as any).hold_minutes);

      totalTrades++;
      netBpsSum += pnlBps;
      holdMinutesSum += holdMinutes;

      if (pnlUsd > 0) {
        wins++;
        winBpsSum += pnlBps;
      } else if (pnlUsd < 0) {
        losses++;
        lossBpsSumAbs += Math.abs(pnlBps);
      }
    }

    const tradesCount = totalTrades;
    const winRatePct = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;
    const avgWinBps = wins > 0 ? winBpsSum / wins : 0;
    const avgLossBps = losses > 0 ? lossBpsSumAbs / losses : 0;
    const edgePerTradeBps = tradesCount > 0 ? netBpsSum / tradesCount : 0;
    const avgHoldMinutes = tradesCount > 0 ? holdMinutesSum / tradesCount : 0;

    const currentProfitTarget = 160;
    const currentTrailOffset = 80;
    const currentReconConf = 0.78;

    let recommendedProfitTarget = currentProfitTarget;
    let recommendedTrailOffset = currentTrailOffset;
    let recommendedReconConf = currentReconConf;

    let confidence: "LOW_SAMPLE" | "MEDIUM_SAMPLE" | "HIGHER_CONFIDENCE" =
      "LOW_SAMPLE";

    if (tradesCount >= 10) confidence = "MEDIUM_SAMPLE";
    if (tradesCount >= 30) confidence = "HIGHER_CONFIDENCE";

    // Advisory logic only
    if (tradesCount >= 5) {
      // If losses are larger than wins, tighten targets and trails slightly
      if (avgLossBps > avgWinBps && avgWinBps > 0) {
        recommendedProfitTarget = Math.max(120, currentProfitTarget - 20);
        recommendedTrailOffset = Math.max(60, currentTrailOffset - 10);
      }

      // If win rate is weak, require stronger confidence
      if (winRatePct < 40) {
        recommendedReconConf = Math.min(0.85, currentReconConf + 0.03);
      }

      // If edge is healthy and winners are meaningfully bigger than losers,
      // allow modestly looser target
      if (edgePerTradeBps > 15 && avgWinBps > avgLossBps && winRatePct >= 45) {
        recommendedProfitTarget = Math.min(220, currentProfitTarget + 10);
      }

      // If average hold is too long, tighten trail a bit
      if (avgHoldMinutes > 240) {
        recommendedTrailOffset = Math.max(60, recommendedTrailOffset - 10);
      }
    }

    return json(200, {
      ok: true,
      status: "STRATEGY_ADJUSTMENTS_READY",

      meta: {
        advisoryOnly: true,
        basis: "completed_trades",
        lookbackDays,
        since,
        sampleConfidence: confidence,
        avgHoldMinutes: Number(avgHoldMinutes.toFixed(2)),
        notes: [
          "Recommendations are based on completed round-trip trades only.",
          "This panel is advisory and does not modify live trading parameters.",
          "Low sample sizes should not be trusted for aggressive optimization.",
        ],
      },

      stats: {
        trades: tradesCount,
        wins,
        losses,
        winRate: Number(winRatePct.toFixed(2)),
        avgWinBps: Number(avgWinBps.toFixed(2)),
        avgLossBps: Number(avgLossBps.toFixed(2)),
        edgePerTradeBps: Number(edgePerTradeBps.toFixed(2)),
      },

      current: {
        profitTargetBps: currentProfitTarget,
        trailOffsetBps: currentTrailOffset,
        reconConfidence: currentReconConf,
      },

      recommended: {
        profitTargetBps: recommendedProfitTarget,
        trailOffsetBps: recommendedTrailOffset,
        reconConfidence: Number(recommendedReconConf.toFixed(2)),
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "STRATEGY_ADJUSTMENTS_ERROR",
      error: e?.message || String(e),
    });
  }
}