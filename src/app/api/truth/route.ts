import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. Get recent trades
    const { data: trades } = await supabase
      .from("trade_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // 2. Calculate edge
    let totalEdge = 0;
    let wins = 0;
    let losses = 0;

    trades?.forEach((t: any) => {
      const pnl = Number(t.pnl_bps || 0);

      totalEdge += pnl;
      if (pnl > 0) wins++;
      if (pnl < 0) losses++;
    });

    const sampleSize = trades?.length || 0;
    const edgePerTrade = sampleSize ? totalEdge / sampleSize : 0;

    // 3. Latest decision
    const last = trades?.[0];

    const status =
      last?.mode === "HOLD"
        ? "HOLD"
        : last?.side === "BUY"
        ? "ACTIVE"
        : last?.side === "SELL"
        ? "EXIT"
        : "UNKNOWN";

    return NextResponse.json({
      edge: {
        edgePerTradeBps: Number(edgePerTrade.toFixed(2)),
        sampleSize,
        wins,
        losses,
      },

      system: {
        status,
        lastAction: last?.side || "NONE",
        price: last?.price || null,
        time: last?.created_at || null,
      },

      note:
        edgePerTrade < 0
          ? "System currently negative — data collection phase"
          : "System showing positive edge",

      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Truth layer failed", details: err },
      { status: 500 }
    );
  }
}