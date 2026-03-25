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
      .order("created_at", { ascending: true }) // IMPORTANT: oldest → newest
      .limit(200);

    let openTrade: any = null;
    let completedTrades: number[] = [];

    for (const t of trades || []) {
      const price = Number(t.price);

      // ENTRY
      if (t.side === "BUY") {
        openTrade = { entry: price };
      }

      // EXIT
      if (t.side === "SELL" && openTrade) {
        const entry = openTrade.entry;
        const exit = price;

        const pnlPct = (exit - entry) / entry;
        const pnlBps = pnlPct * 10000;

        completedTrades.push(pnlBps);

        openTrade = null;
      }
    }

    // Stats
    const sampleSize = completedTrades.length;

    const totalEdge = completedTrades.reduce((a, b) => a + b, 0);

    const edgePerTrade = sampleSize
      ? totalEdge / sampleSize
      : 0;

    const wins = completedTrades.filter((x) => x > 0).length;
    const losses = completedTrades.filter((x) => x < 0).length;

    // Latest trade
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
          ? "System negative — evaluating edge"
          : edgePerTrade > 0
          ? "System showing positive edge"
          : "System neutral — insufficient data",

      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Truth layer failed", details: err },
      { status: 500 }
    );
  }
}