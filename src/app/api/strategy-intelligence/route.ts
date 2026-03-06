import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function safe(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("trade_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ ok: false, error });
    }

    let wins = 0;
    let losses = 0;
    let winTotal = 0;
    let lossTotal = 0;

    let entryQualityTotal = 0;
    let entryCount = 0;

    let exitEfficiencyTotal = 0;
    let exitCount = 0;

    for (const t of data || []) {

      const decision = t.decision || {};
      const pnl = safe(decision.pnlBps);

      if (pnl > 0) {
        wins++;
        winTotal += pnl;
      }

      if (pnl < 0) {
        losses++;
        lossTotal += Math.abs(pnl);
      }

      if (decision.entryPrice && decision.current) {
        const entryEdge =
          ((safe(decision.current) - safe(decision.entryPrice)) /
            safe(decision.entryPrice)) *
          100;

        entryQualityTotal += entryEdge;
        entryCount++;
      }

      if (decision.peakPrice && decision.current) {
        const efficiency =
          safe(decision.current) / safe(decision.peakPrice);

        exitEfficiencyTotal += efficiency;
        exitCount++;
      }
    }

    const avgWin = wins ? winTotal / wins : 0;
    const avgLoss = losses ? lossTotal / losses : 0;

    const edgePerTrade = avgWin - avgLoss;

    const entryQuality = entryCount
      ? entryQualityTotal / entryCount
      : 0;

    const exitEfficiency = exitCount
      ? exitEfficiencyTotal / exitCount
      : 0;

    return NextResponse.json({
      ok: true,

      tradesAnalyzed: data?.length || 0,

      wins,
      losses,

      avgWinBps: avgWin,
      avgLossBps: avgLoss,

      edgePerTradeBps: edgePerTrade,

      entryQualityPct: entryQuality,

      exitEfficiencyPct: exitEfficiency * 100,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: String(err),
    });
  }
}