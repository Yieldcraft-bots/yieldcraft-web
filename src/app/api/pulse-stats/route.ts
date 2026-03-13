// src/app/api/pulse-stats/route.ts
// Read-only Pulse stats powered by completed_trades view

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

/**
 * Central time (America/Chicago) "start of today"
 * (simple CST offset for launch)
 */
function startOfTodayISO_Central(): string {
  const now = new Date();

  const central = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const startCentralAsUTC = new Date(
    Date.UTC(
      central.getUTCFullYear(),
      central.getUTCMonth(),
      central.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const startUTC = new Date(startCentralAsUTC.getTime() + 6 * 60 * 60 * 1000);
  return startUTC.toISOString();
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
        status: "PULSE_STATS_NOT_CONFIGURED",
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const since = startOfTodayISO_Central();

    const { data, error } = await supabase
      .from("completed_trades")
      .select("*")
      .eq("user_id", CORE_FUND_USER_ID)
      .gte("exit_time", since)
      .order("exit_time", { ascending: true });

    if (error) {
      return json(200, {
        ok: false,
        status: "PULSE_STATS_QUERY_ERROR",
        error: error.message,
      });
    }

    const trades = data?.length ?? 0;

    let wins = 0;
    let losses = 0;
    let netPnL = 0;

    for (const t of data || []) {
      const pnl = Number(t.pnl_usd) || 0;

      netPnL += pnl;

      if (pnl > 0) wins++;
      if (pnl < 0) losses++;
    }

    const winRate = trades > 0 ? wins / trades : null;

    return json(200, {
      ok: true,
      status: "PULSE_STATS_READY",
      source: "completed_trades",
      since,
      stats: {
        trades,
        wins,
        losses,
        winRate,
        netPnL,
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "PULSE_STATS_ERROR",
      error: e?.message || String(e),
    });
  }
}