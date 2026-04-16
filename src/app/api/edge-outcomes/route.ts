import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LOOKAHEAD_WINDOWS = [5, 15, 30];

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractRangeSignal(note: string | null | undefined) {
  if (!note) return null;
  const match = note.match(/range_signal=([A-Z_]+)/);
  return match?.[1] || null;
}

export async function POST() {
  try {
    const supabase = getAdminClient();

    const { data: logs, error: logsError } = await supabase
      .from("edge_hunter_logs")
      .select("id, created_at, note, regime, structure, volatility_bps")
      .order("created_at", { ascending: false })
      .limit(100);

    if (logsError) {
      return NextResponse.json({ ok: false, error: logsError.message });
    }

    const filteredLogs = (logs || [])
      .map((log) => ({
        ...log,
        range_signal: extractRangeSignal(log.note),
      }))
      .filter((log) => log.range_signal);

    const results: any[] = [];

    for (const log of filteredLogs) {
      const entryTs = new Date(log.created_at);
      const entryStart = Math.floor(entryTs.getTime() / 1000);
      const entryEnd = entryStart + 60;

      const entryUrl =
        `https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles` +
        `?start=${entryStart}&end=${entryEnd}&granularity=ONE_MINUTE`;

      const entryRes = await fetch(entryUrl, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });

      const entryJson = await entryRes.json();
      const entryCandle = entryJson?.candles?.[0];
      const entryPrice = Number(entryCandle?.close);

      if (!Number.isFinite(entryPrice) || entryPrice <= 0) continue;

      for (const minutes of LOOKAHEAD_WINDOWS) {
        const { data: existing } = await supabase
          .from("edge_outcomes")
          .select("id")
          .eq("log_id", log.id)
          .eq("minutes", minutes)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const futureStart = entryStart + minutes * 60;
        const futureEnd = futureStart + 60;

        const exitUrl =
          `https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles` +
          `?start=${futureStart}&end=${futureEnd}&granularity=ONE_MINUTE`;

        const exitRes = await fetch(exitUrl, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });

        const exitJson = await exitRes.json();
        const exitCandle = exitJson?.candles?.[0];
        const exitPrice = Number(exitCandle?.close);

        if (!Number.isFinite(exitPrice) || exitPrice <= 0) continue;

        const direction = log.range_signal === "SELL_UPPER_BAND" ? -1 : 1;
        const pnl_bps = ((exitPrice - entryPrice) / entryPrice) * 10000 * direction;

        results.push({
          log_id: log.id,
          minutes,
          signal: log.range_signal,
          direction,
          entry_price: Number(entryPrice.toFixed(2)),
          exit_price: Number(exitPrice.toFixed(2)),
          pnl_bps: Number(pnl_bps.toFixed(2)),
          regime: log.regime,
          structure: log.structure,
          volatility_bps: log.volatility_bps,
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
      logs_scanned: filteredLogs.length,
      outcomes_inserted: results.length,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}