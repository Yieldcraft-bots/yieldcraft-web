// src/app/api/strategy-adjustments/route.ts
// Read-only strategy recommendation engine for Pulse
// No trading side effects — analysis only.

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

function startOfTodayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET() {
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

    const since = startOfTodayISO();

    const { data, error } = await supabase
      .from("trade_logs")
      .select("*")
      .gte("created_at", since);

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
    let winBps = 0;
    let lossBps = 0;

    for (const r of rows) {
      const side = String(r.side || "").toUpperCase();
      const decision = r.decision || {};
      const pnlBps = n(decision.pnlBps);

      if (side !== "SELL") continue;

      if (pnlBps > 0) {
        wins++;
        winBps += pnlBps;
      } else {
        losses++;
        lossBps += Math.abs(pnlBps);
      }
    }

    const trades = wins + losses;
    const winRate = trades > 0 ? wins / trades : 0;

    const avgWin = wins > 0 ? winBps / wins : 0;
    const avgLoss = losses > 0 ? lossBps / losses : 0;

    const currentProfitTarget = 160;
    const currentTrailOffset = 80;
    const currentReconConf = 0.78;

    let recommendedProfitTarget = currentProfitTarget;
    let recommendedTrailOffset = currentTrailOffset;
    let recommendedReconConf = currentReconConf;

    if (avgWin < avgLoss) {
      recommendedProfitTarget = Math.max(120, currentProfitTarget - 20);
    }

    if (winRate < 0.4) {
      recommendedReconConf = Math.min(0.85, currentReconConf + 0.03);
    }

    if (avgLoss > avgWin) {
      recommendedTrailOffset = Math.max(60, currentTrailOffset - 10);
    }

    return json(200, {
      ok: true,
      status: "STRATEGY_ADJUSTMENTS_READY",

      stats: {
        trades,
        wins,
        losses,
        winRate,
        avgWinBps: Number(avgWin.toFixed(2)),
        avgLossBps: Number(avgLoss.toFixed(2)),
      },

      current: {
        profitTargetBps: currentProfitTarget,
        trailOffsetBps: currentTrailOffset,
        reconConfidence: currentReconConf,
      },

      recommended: {
        profitTargetBps: recommendedProfitTarget,
        trailOffsetBps: recommendedTrailOffset,
        reconConfidence: recommendedReconConf,
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