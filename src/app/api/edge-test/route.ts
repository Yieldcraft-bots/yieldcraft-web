// src/app/api/edge-test/route.ts
// Read-only edge analysis using completed_trades

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const CORE_FUND_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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
        status: "EDGE_TEST_NOT_CONFIGURED",
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("completed_trades")
      .select("*")
      .eq("user_id", CORE_FUND_USER_ID)
      .order("exit_time", { ascending: true });

    if (error) {
      return json(200, {
        ok: false,
        status: "EDGE_TEST_QUERY_ERROR",
        error: error.message,
      });
    }

    const trades = data ?? [];

    const totalTrades = trades.length;

    let wins = 0;
    let losses = 0;

    let totalPnL = 0;
    let totalBps = 0;

    let totalWinBps = 0;
    let totalLossBps = 0;

    for (const t of trades) {
      const pnl = Number(t.pnl_usd) || 0;
      const bps = Number(t.pnl_bps) || 0;

      totalPnL += pnl;
      totalBps += bps;

      if (pnl > 0) {
        wins++;
        totalWinBps += bps;
      }

      if (pnl < 0) {
        losses++;
        totalLossBps += bps;
      }
    }

    const avgWinBps = wins > 0 ? totalWinBps / wins : 0;
    const avgLossBps = losses > 0 ? totalLossBps / losses : 0;

    const edgePerTrade = totalTrades > 0 ? totalBps / totalTrades : 0;

    const winRate = totalTrades > 0 ? wins / totalTrades : null;

    return json(200, {
      ok: true,
      status: "EDGE_TEST_READY",
      sampleSize: totalTrades,
      wins,
      losses,
      winRate,
      avgWinBps,
      avgLossBps,
      edgePerTradeBps: edgePerTrade,
      totalPnL,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "EDGE_TEST_ERROR",
      error: e?.message || String(e),
    });
  }
}