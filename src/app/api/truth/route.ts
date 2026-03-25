import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: trades } = await supabase
      .from("trade_logs")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);

    let openTrade: { entry: number } | null = null;
    const completedTrades: number[] = [];

    for (const t of trades || []) {
      const price = Number(t.price || 0);

      if (!price) continue;

      if (t.side === "BUY") {
        openTrade = { entry: price };
        continue;
      }

      if (t.side === "SELL" && openTrade) {
        const entry = openTrade.entry;
        const exit = price;
        const pnlPct = (exit - entry) / entry;
        const pnlBps = pnlPct * 10000;
        completedTrades.push(pnlBps);
        openTrade = null;
      }
    }

    const sampleSize = completedTrades.length;
    const totalEdge = completedTrades.reduce((sum, x) => sum + x, 0);
    const edgePerTrade = sampleSize ? totalEdge / sampleSize : 0;
    const wins = completedTrades.filter((x) => x > 0).length;
    const losses = completedTrades.filter((x) => x < 0).length;

    const last = trades?.[trades.length - 1];

    const status =
      last?.mode === "HOLD"
        ? "HOLD"
        : last?.side === "BUY"
        ? "ACTIVE"
        : last?.side === "SELL"
        ? "EXIT"
        : "UNKNOWN";

    return NextResponse.json({
      version: "truth-v2-paired-trades",
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
        sampleSize === 0
          ? "No completed trade pairs found yet"
          : edgePerTrade < 0
          ? "System negative — evaluating edge"
          : edgePerTrade > 0
          ? "System showing positive edge"
          : "System neutral",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Truth layer failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}