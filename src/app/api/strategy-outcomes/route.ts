import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Keep locked to BTC-USD for stability
const PRODUCT_ID = "BTC-USD";

// How many pending rows to process per run
const BATCH_SIZE = 50;

// Evaluate in 5m candle steps
const WINDOWS_MIN = [5, 15, 30, 60] as const;

// Conservative outcome classification thresholds
const TARGET_BPS = 100; // +1.00%
const STOP_BPS = -60;   // -0.60%

type DecisionRow = {
  id: string;
  created_at: string;
  outcome_status: string | null;
  decision_mode?: string | null;
  action_phase?: string | null;
};

type Candle = {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
};

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string, value?: string) {
  if (!value || !value.trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return value.trim();
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function roundBps(n: number) {
  return Math.round(n * 100) / 100;
}

function bps(fromPrice: number, toPrice: number) {
  return ((toPrice - fromPrice) / fromPrice) * 10000;
}

function classifyOutcome(params: {
  entryAllowed: boolean;
  outcome30m: number | null;
  bestBps: number | null;
  worstBps: number | null;
}) {
  const { entryAllowed, outcome30m, bestBps, worstBps } = params;

  if (entryAllowed) {
    if (outcome30m == null) return "PENDING";
    if (outcome30m >= TARGET_BPS) return "WIN";
    if (outcome30m <= STOP_BPS) return "LOSS";
    return "MIXED";
  }

  // Blocked-entry logic
  if (bestBps != null && bestBps >= TARGET_BPS) return "MISSED_WIN";
  if (worstBps != null && worstBps <= STOP_BPS) return "GOOD_BLOCK";
  if (outcome30m != null && outcome30m > 0) return "MISSED_WIN_LIGHT";
  if (outcome30m != null && outcome30m <= 0) return "GOOD_BLOCK_LIGHT";
  return "PENDING";
}

async function fetchPublicCandles(startUnix: number, endUnix: number): Promise<Candle[]> {
  const url = new URL(
    `https://api.coinbase.com/api/v3/brokerage/market/products/${PRODUCT_ID}/candles`
  );
  url.searchParams.set("start", String(startUnix));
  url.searchParams.set("end", String(endUnix));
  url.searchParams.set("granularity", "FIVE_MINUTE");
  url.searchParams.set("limit", "350");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coinbase candles failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const candles = Array.isArray(data?.candles) ? (data.candles as Candle[]) : [];

  return candles.sort((a, b) => Number(a.start) - Number(b.start));
}

function getFirstCandleAtOrAfter(candles: Candle[], tsUnix: number): Candle | null {
  for (const candle of candles) {
    if (Number(candle.start) >= tsUnix) return candle;
  }
  return null;
}

function getCloseAtOrAfter(candles: Candle[], tsUnix: number): number | null {
  const candle = getFirstCandleAtOrAfter(candles, tsUnix);
  if (!candle) return null;
  const close = Number(candle.close);
  return Number.isFinite(close) ? close : null;
}

export async function POST(_req: NextRequest) {
  try {
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("strategy_decisions")
      .select("id, created_at, outcome_status, decision_mode, action_phase")
      .is("outcome_status", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      return json(500, {
        ok: false,
        stage: "select_pending_rows",
        error: error.message,
      });
    }

    if (!rows || rows.length === 0) {
      return json(200, {
        ok: true,
        processed: 0,
        updated: 0,
        message: "No pending strategy_decisions rows found.",
      });
    }

    const firstTs = new Date(rows[0].created_at);
    const lastTs = new Date(rows[rows.length - 1].created_at);

    const startUnix = toUnixSeconds(new Date(firstTs.getTime() - 10 * 60 * 1000));
    const endUnix = toUnixSeconds(new Date(lastTs.getTime() + 70 * 60 * 1000));

    const candles = await fetchPublicCandles(startUnix, endUnix);

    let updated = 0;
    const results: any[] = [];

    for (const row of rows as DecisionRow[]) {
      const decisionTime = new Date(row.created_at);
      const decisionUnix = toUnixSeconds(decisionTime);

      const basePrice = getCloseAtOrAfter(candles, decisionUnix);
      if (!basePrice) {
        results.push({
          id: row.id,
          ok: false,
          reason: "base_price_not_found",
        });
        continue;
      }

      const outcomeMap: Record<string, number | null> = {};
      for (const min of WINDOWS_MIN) {
        const targetUnix = decisionUnix + min * 60;
        const px = getCloseAtOrAfter(candles, targetUnix);
        outcomeMap[min] = px != null ? roundBps(bps(basePrice, px)) : null;
      }

      const observed = Object.values(outcomeMap).filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v)
      );

      const bestBps = observed.length ? roundBps(Math.max(...observed)) : null;
      const worstBps = observed.length ? roundBps(Math.min(...observed)) : null;

      const outcome30m = outcomeMap[30] ?? null;
      const outcome60m = outcomeMap[60] ?? null;

      const targetHit30m = outcome30m != null ? outcome30m >= TARGET_BPS : null;
      const targetHit60m = outcome60m != null ? outcome60m >= TARGET_BPS : null;
      const stopHit30m = outcome30m != null ? outcome30m <= STOP_BPS : null;
      const stopHit60m = outcome60m != null ? outcome60m <= STOP_BPS : null;

      const entryAllowed = row.decision_mode === "ENTRY_ALLOWED";
      const outcomeStatus = classifyOutcome({
        entryAllowed,
        outcome30m,
        bestBps,
        worstBps,
      });

      const { error: updateError } = await supabase
        .from("strategy_decisions")
        .update({
          outcome_5m_bps: outcomeMap[5],
          outcome_15m_bps: outcomeMap[15],
          outcome_30m_bps: outcomeMap[30],
          outcome_60m_bps: outcomeMap[60],
          best_outcome_bps: bestBps,
          worst_outcome_bps: worstBps,
          target_hit_30m: targetHit30m,
          target_hit_60m: targetHit60m,
          stop_hit_30m: stopHit30m,
          stop_hit_60m: stopHit60m,
          outcome_status: outcomeStatus,
        })
        .eq("id", row.id);

      if (updateError) {
        results.push({
          id: row.id,
          ok: false,
          reason: "update_failed",
          error: updateError.message,
        });
        continue;
      }

      updated += 1;
      results.push({
        id: row.id,
        ok: true,
        decision_mode: row.decision_mode,
        action_phase: row.action_phase,
        basePrice,
        outcome_5m_bps: outcomeMap[5],
        outcome_15m_bps: outcomeMap[15],
        outcome_30m_bps: outcomeMap[30],
        outcome_60m_bps: outcomeMap[60],
        best_outcome_bps: bestBps,
        worst_outcome_bps: worstBps,
        outcome_status: outcomeStatus,
      });
    }

    return json(200, {
      ok: true,
      processed: rows.length,
      updated,
      product_id: PRODUCT_ID,
      results,
    });
  } catch (err: any) {
    return json(500, {
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}