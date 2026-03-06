// src/app/api/pulse-stats/route.ts
// Read-only daily stats snapshot for Pulse (NO trading side effects)

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
 * Central time (America/Chicago) "start of today" without external libs.
 * Note: Fixed -6 offset (CST). Good enough for launch; we can make DST-aware later.
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
  user_id?: string | null;
  product_id?: string;
  side?: "BUY" | "SELL" | string | null;
  base_size?: string | number | null;
  quote_size?: string | number | null;
  price?: string | number | null;
  fee_usd?: string | number | null;
  fee?: string | number | null;
  pnl_usd?: string | number | null;
  status?: string | number | null | Record<string, any>;
};

function n(x: any): number {
  const v =
    typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(v) ? v : 0;
}

function s(x: any): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function computeStats(rows: TradeRow[]) {
  const fills = rows
    .filter((r) => s((r as any).status).toLowerCase() !== "rejected")
    .filter((r) => {
      const side = s((r as any).side).toUpperCase();
      return side === "BUY" || side === "SELL";
    })
    .sort(
      (a, b) =>
        new Date(s((a as any).created_at) || 0).getTime() -
        new Date(s((b as any).created_at) || 0).getTime()
    );

  const trades = fills.length;

  const totalFees = fills.reduce(
    (acc, r) => acc + n((r as any).fee_usd ?? (r as any).fee),
    0
  );

  const hasPnLField = fills.some(
    (r) => "pnl_usd" in r && Number.isFinite(Number((r as any).pnl_usd))
  );

  let grossPnL = 0;
  let sells = 0;
  let wins = 0;
  let losses = 0;

  if (hasPnLField) {
    for (const r of fills) {
      const side = s((r as any).side).toUpperCase();
      const rowPnl = n((r as any).pnl_usd);

      grossPnL += rowPnl;

      if (side === "SELL") {
        sells++;
        if (rowPnl > 0) wins++;
        else if (rowPnl < 0) losses++;
      }
    }
  } else {
    type Lot = { qty: number; cost: number };
    const lots: Lot[] = [];

    for (const r of fills) {
      const side = s((r as any).side).toUpperCase();
      const qty = n((r as any).base_size);
      const price = n((r as any).price);
      const quote = n((r as any).quote_size);
      const notional = quote > 0 ? quote : qty * price;

      if (side === "BUY") {
        lots.push({ qty, cost: notional });
        continue;
      }

      if (side === "SELL") {
        sells++;

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

        const realizedSellPnl = notional - costBasis;
        grossPnL += realizedSellPnl;

        if (realizedSellPnl > 0) wins++;
        else if (realizedSellPnl < 0) losses++;
      }
    }
  }

  const netPnL = grossPnL - totalFees;
  const winRate = sells > 0 ? wins / sells : null;

  return {
    trades,
    sells,
    wins,
    losses,
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

    const since = startOfTodayISO_Central();

    let tableUsed: string | null = null;
    let rows: TradeRow[] = [];
    let lastErr: any = null;

    for (const table of TRADE_TABLE_CANDIDATES) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", CORE_FUND_USER_ID)
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
      scope: "core_fund_only",
      user_id: CORE_FUND_USER_ID,
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