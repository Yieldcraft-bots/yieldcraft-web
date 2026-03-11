// src/app/api/strategy-adjustments/route.ts
// Read-only strategy recommendation engine for Pulse
// No trading side effects — analysis only.

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

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
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
      .from("trade_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) {
      return json(200, {
        ok: false,
        status: "TRADE_LOG_FETCH_ERROR",
        error: error.message,
      });
    }

    const rows = Array.isArray(data) ? data : [];

    let wins = 0;
    let losses = 0;
    let totalClosedTrades = 0;
    let winBpsSum = 0;
    let lossBpsSum = 0;
    let netBpsSum = 0;

    let usableRows = 0;
    let skippedRows = 0;

    for (const r of rows) {
      const side = String(r?.side || "").toUpperCase();
      const decision =
        r?.decision && typeof r.decision === "object" ? r.decision : {};

      // Strategy suggestions should be based on realized outcomes only.
      // We use SELL rows as the current proxy for a completed trade outcome.
      if (side !== "SELL") {
        skippedRows++;
        continue;
      }

      const pnlBps = n((decision as any).pnlBps);

      // Skip rows that do not have a meaningful realized pnlBps.
      if (!Number.isFinite(pnlBps) || pnlBps === 0) {
        skippedRows++;
        continue;
      }

      usableRows++;
      totalClosedTrades++;
      netBpsSum += pnlBps;

      if (pnlBps > 0) {
        wins++;
        winBpsSum += pnlBps;
      } else {
        losses++;
        lossBpsSum += Math.abs(pnlBps);
      }
    }

    const trades = totalClosedTrades;
    const winRate = trades > 0 ? wins / trades : 0;
    const avgWin = wins > 0 ? winBpsSum / wins : 0;
    const avgLoss = losses > 0 ? lossBpsSum / losses : 0;
    const edgePerTradeBps = trades > 0 ? netBpsSum / trades : 0;

    // Current values are still static defaults for now.
    // This route is advisory only and should not mutate execution config.
    const currentProfitTarget = 160;
    const currentTrailOffset = 80;
    const currentReconConf = 0.78;

    let recommendedProfitTarget = currentProfitTarget;
    let recommendedTrailOffset = currentTrailOffset;
    let recommendedReconConf = currentReconConf;

    // Confidence labeling for UI honesty
    let confidence: "LOW_SAMPLE" | "MEDIUM_SAMPLE" | "HIGHER_CONFIDENCE" =
      "LOW_SAMPLE";

    if (trades >= 30) confidence = "MEDIUM_SAMPLE";
    if (trades >= 75) confidence = "HIGHER_CONFIDENCE";

    // Advisory rules:
    // Only make suggestions when there is enough sample to justify them.
    if (trades >= 10) {
      // If losses are larger than wins, tighten target modestly.
      if (avgLoss > avgWin && avgWin > 0) {
        recommendedProfitTarget = Math.max(120, currentProfitTarget - 20);
      }

      // If win rate is poor, require slightly stronger confidence to enter.
      if (winRate < 0.4) {
        recommendedReconConf = Math.min(0.85, currentReconConf + 0.03);
      }

      // If average loss is meaningfully larger than average win, tighten trail.
      if (avgLoss > avgWin && avgLoss > 0) {
        recommendedTrailOffset = Math.max(60, currentTrailOffset - 10);
      }

      // If expectancy is solid and win rate healthy, allow slightly looser target.
      if (edgePerTradeBps > 20 && winRate >= 0.55 && avgWin > avgLoss) {
        recommendedProfitTarget = Math.min(220, currentProfitTarget + 10);
      }
    }

    return json(200, {
      ok: true,
      status: "STRATEGY_ADJUSTMENTS_READY",

      meta: {
        advisoryOnly: true,
        basis: "closed_trade_logs_with_realized_pnl_bps",
        lookbackDays,
        since,
        rowsFetched: rows.length,
        usableRows,
        skippedRows,
        sampleConfidence: confidence,
        notes: [
          "Recommendations are based on realized SELL-side closed trade outcomes only.",
          "This panel is advisory and does not modify live trading parameters.",
          "Low sample sizes should not be trusted for aggressive optimization.",
        ],
      },

      stats: {
        trades,
        wins,
        losses,
        winRate: Number((winRate * 100).toFixed(2)),
        avgWinBps: Number(avgWin.toFixed(2)),
        avgLossBps: Number(avgLoss.toFixed(2)),
        edgePerTradeBps: Number(edgePerTradeBps.toFixed(2)),
        netBps: Number(netBpsSum.toFixed(2)),
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