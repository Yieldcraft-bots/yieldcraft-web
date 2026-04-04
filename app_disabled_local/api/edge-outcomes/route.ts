import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🔐 Uses existing env — no new secrets
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOOKAHEAD_WINDOWS = [5, 15, 30]; // minutes

export async function POST() {
  try {
    // 1. Get recent edge hunter logs that do NOT have outcomes yet
    const { data: logs, error: logsError } = await supabase
      .from("edge_hunter_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (logsError) {
      return NextResponse.json({ ok: false, error: logsError.message });
    }

    const results: any[] = [];

    for (const log of logs || []) {
      const entryTime = new Date(log.created_at).getTime();
      const entryPrice = log.price;

      if (!entryPrice) continue;

      for (const minutes of LOOKAHEAD_WINDOWS) {
        const futureTime = entryTime + minutes * 60 * 1000;

        // 2. Get closest candle AFTER the future time
        const { data: candles } = await supabase
          .from("market_candles") // ⚠️ adjust if your table name differs
          .select("*")
          .gte("timestamp", new Date(futureTime).toISOString())
          .order("timestamp", { ascending: true })
          .limit(1);

        if (!candles || candles.length === 0) continue;

        const exitPrice = candles[0].close;

        const pnl_bps =
          ((exitPrice - entryPrice) / entryPrice) * 10000;

        results.push({
          log_id: log.id,
          minutes,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pnl_bps,
          regime: log.regime,
          volatility_bps: log.volatility_bps,
          structure: log.structure,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (results.length > 0) {
      const { error: insertError } = await supabase
        .from("edge_outcomes")
        .insert(results);

      if (insertError) {
        return NextResponse.json({ ok: false, error: insertError.message });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    });
  }
}