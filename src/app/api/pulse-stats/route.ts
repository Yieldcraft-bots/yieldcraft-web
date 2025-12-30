// src/app/api/pulse-stats/route.ts
// Read-only daily stats snapshot for Pulse (NO trading side effects)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Central time (America/Chicago) "start of today" without external libs.
 * Note: Fixed -6 offset (CST). Good enough for launch; we can make DST-aware later.
 */
function startOfTodayISO_Central(): string {
  const now = new Date();

  // shift "now" into Central by fixed -6 hours
  const central = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  // build a UTC-date representing Central midnight (00:00 in "central" clock)
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

  // convert back to real UTC instant by shifting +6 hours
  const startUTC = new Date(startCentralAsUTC.getTime() + 6 * 60 * 60 * 1000);
  return startUTC.toISOString();
}

/**
 * We intentionally support multiple possible table names so you don't get blocked
 * if your project uses a different one.
 */
const TRADE_TABLE_CANDIDATES = [
  "Trades_v1",
  "trades_v1",
  "trades",
  "pulse_trades",
  "trade_logs",
];

type TradeRow = {
  id?: string | number;
  created_at?: string;
  product_id?: string;
  side?: "BUY" | "SELL" | string;
  base_size?: string | number;
  quote_size?: string | number;
  price?: string | number;
  fee_usd?: string | number;
  fee?: string | number;
  pnl_usd?: string | number;
  status?: string;
};

function n(x: any): number {
  const v =
    typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(v) ? v : 0;
}

/**
 * Simple realized P&L for a single-position style bot:
 * - If pnl_usd exists on rows, we sum it (preferred).
 * - Otherwise estimate realized pnl from SELL proceeds - BUY cost - fees using FIFO inventory.
 */
function computeStats(rows: TradeRow[]) {
  const fills = rows
    .filter((r) => (r.status || "").toLowerCase() !== "rejected")
    .filter((r) => {
      const s = (r.side || "").toUpperCase();
      return s === "BUY" || s === "SELL";
    })
    .sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime()
    );

  const trades = fills.length;

  const hasPnLField = fills.some(
    (r) => "pnl_usd" in r && n((r as any).pnl_usd) !== 0
  );

  // Fees: accept fee_usd or fee
  const totalFees = fills.reduce(
    (acc, r) => acc + n((r as any).fee_usd ?? (r as any).fee),
    0
  );

  let realized = 0;

  if (hasPnLField) {
    realized = fills.reduce((acc, r) => acc + n((r as any).pnl_usd), 0);
  } else {
    // FIFO inventory (base units and cost basis)
    type Lot = { qty: number; cost: number }; // qty in base, cost in USD
    const lots: Lot[] = [];

    for (const r of fills) {
      const side = (r.side || "").toUpperCase();
      const qty = n(r.base_size);
      const price = n(r.price);

      // If quote_size is present, prefer that for total cost/proceeds.
      const quote = n(r.quote_size);
      const notional = quote > 0 ? quote : qty * price;

      if (side === "BUY") {
        lots.push({ qty, cost: notional });
      } else if (side === "SELL") {
        // realize pnl against lots
        let remaining = qty;
        let costBasis = 0;

        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const take = Math.min(remaining, lot.qty);
          const unitCost = lot.qty > 0 ? lot.cost / lot.qty : 0;

          costBasis += take * unitCost;

          lot.qty -= take;
          lot.cost -= take * unitCost;
          remaining -= take;

          if (lot.qty <= 1e-12) lots.shift();
        }

        realized += notional - costBasis;
      }
    }
  }

  // Gross / Net
  const grossPnL = realized;
  const netPnL = realized - totalFees;

  // Win rate (simple): if pnl_usd exists per sell, count wins.
  let sells = 0;
  let wins = 0;

  for (const r of fills) {
    if ((r.side || "").toUpperCase() !== "SELL") continue;
    sells++;
    if ("pnl_usd" in r && n((r as any).pnl_usd) > 0) wins++;
  }

  const winRate = sells > 0 ? wins / sells : null;

  return {
    trades,
    sells,
    wins,
    winRate,
    grossPnL,
    totalFees,
    netPnL,
  };
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
        needed_env: [
          "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
          "SUPABASE_SERVICE_ROLE_KEY",
        ],
        note:
          "This endpoint is read-only. Add the env vars in Vercel, redeploy, and retry.",
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // Central-time day start for "today"
    const since = startOfTodayISO_Central();

    // Try table candidates until one succeeds
    let tableUsed: string | null = null;
    let rows: TradeRow[] = [];
    let lastErr: any = null;

    for (const table of TRADE_TABLE_CANDIDATES) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        tableUsed = table;
        rows = data as any;
        break;
      }
      lastErr = error;
    }

    if (!tableUsed) {
      return json(200, {
        ok: false,
        status: "PULSE_STATS_TABLE_NOT_FOUND",
        tried_tables: TRADE_TABLE_CANDIDATES,
        hint:
          "If your trade log table has a different name, rename one of the candidates or add yours to the list.",
        supabase_error: lastErr?.message || String(lastErr || ""),
      });
    }

    const stats = computeStats(rows);

    return json(200, {
      ok: true,
      status: "PULSE_STATS_READY",
      dayStart: since,
      table: tableUsed,
      counts: { rows: rows.length },
      stats,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "PULSE_STATS_ERROR",
      error: e?.message || String(e),
    });
  }
}
