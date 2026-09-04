import "server-only";

import type {
  EdgeTrendDirection,
  EdgeTrendSnapshot,
  PulsePerformanceSnapshot,
  TelemetryFreshnessState,
} from "./types";
import { createEdgeIntelligenceReadClient } from "./supabaseReadClient";

type TradeLogRow = {
  user_id?: string | null;
  created_at: string;
  side: "BUY" | "SELL";
  price?: number | string | null;
  base_size?: number | string | null;
  reason?: string | null;
};

type ClosedTrade = {
  exitAt: string;
  grossPnlUsd: number;
  grossBps: number;
  exitReason: string;
};

type DailyBucket = {
  day: string;
  trades: number;
  edgeSum: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getFreshness(
  observedAt: string | null,
  nowMs = Date.now()
): TelemetryFreshnessState {
  if (!observedAt) {
    return "UNKNOWN";
  }

  const observedMs = Date.parse(observedAt);

  if (!Number.isFinite(observedMs)) {
    return "UNKNOWN";
  }

  const ageHours = Math.max(0, (nowMs - observedMs) / 3_600_000);

  if (ageHours <= 24) {
    return "FRESH";
  }

  if (ageHours <= 72) {
    return "AGING";
  }

  return "STALE";
}

function classifyTrend(
  edge7d: number | null,
  edge14d: number | null
): EdgeTrendDirection {
  if (edge7d === null || edge14d === null) {
    return "UNKNOWN";
  }

  const delta = edge7d - edge14d;

  if (Math.abs(delta) < 5) {
    return "STABLE";
  }

  return delta > 0 ? "IMPROVING" : "WEAKENING";
}

function dayKey(value: string): string | null {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function pairClosedTrades(rows: TradeLogRow[]): ClosedTrade[] {
  const byUser = new Map<string, TradeLogRow[]>();

  for (const row of rows) {
    const userId = row.user_id ?? "unknown";
    const existing = byUser.get(userId) ?? [];

    existing.push(row);
    byUser.set(userId, existing);
  }

  const closed: ClosedTrade[] = [];

  for (const userTrades of byUser.values()) {
    const sorted = [...userTrades].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    let openBuy: TradeLogRow | null = null;

    for (const trade of sorted) {
      if (trade.side === "BUY") {
        openBuy = trade;
        continue;
      }

      if (trade.side !== "SELL" || !openBuy) {
        continue;
      }

      const entryPrice = toNumber(openBuy.price);
      const exitPrice = toNumber(trade.price);
      const baseSize = Math.max(
        toNumber(openBuy.base_size),
        toNumber(trade.base_size)
      );

      if (!entryPrice || !exitPrice || !baseSize) {
        openBuy = null;
        continue;
      }

      closed.push({
        exitAt: trade.created_at,
        grossPnlUsd: (exitPrice - entryPrice) * baseSize,
        grossBps: ((exitPrice - entryPrice) / entryPrice) * 10_000,
        exitReason: String(trade.reason ?? "unknown").trim().toLowerCase(),
      });

      openBuy = null;
    }
  }

  return closed.sort(
    (a, b) => Date.parse(a.exitAt) - Date.parse(b.exitAt)
  );
}

export async function readPulsePerformance(): Promise<{
  performance: PulsePerformanceSnapshot;
  trend: EdgeTrendSnapshot;
}> {
  const client = createEdgeIntelligenceReadClient();

  const since = new Date(
    Date.now() - 45 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await client
    .from("trade_logs")
    .select("user_id, created_at, side, price, base_size, reason")
    .in("side", ["BUY", "SELL"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`pulse_performance_read_failed: ${error.message}`);
  }

  const closedTrades = pairClosedTrades((data ?? []) as TradeLogRow[]);

  const wins = closedTrades.filter((trade) => trade.grossBps >= 0);
  const losses = closedTrades.filter((trade) => trade.grossBps < 0);

  const edges = closedTrades.map((trade) => trade.grossBps);
  const winningEdges = wins.map((trade) => trade.grossBps);
  const losingEdges = losses.map((trade) => trade.grossBps);

  const grossPnlUsd = closedTrades.reduce(
    (sum, trade) => sum + trade.grossPnlUsd,
    0
  );

  const hardStops = closedTrades.filter(
    (trade) => trade.exitReason === "hard_stop"
  ).length;

  const trailStops = closedTrades.filter(
    (trade) => trade.exitReason === "trail_stop"
  ).length;

  const daily = new Map<string, DailyBucket>();

  for (const trade of closedTrades) {
    const day = dayKey(trade.exitAt);

    if (!day) {
      continue;
    }

    const existing = daily.get(day) ?? {
      day,
      trades: 0,
      edgeSum: 0,
    };

    existing.trades += 1;
    existing.edgeSum += trade.grossBps;

    daily.set(day, existing);
  }

  const dailyRows = [...daily.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => ({
      ...row,
      avgEdgeBps: row.edgeSum / Math.max(row.trades, 1),
    }));

  const latestDaily = dailyRows.at(-1) ?? null;

  const edge7d = average(
    dailyRows.slice(-7).map((row) => row.avgEdgeBps)
  );

  const edge14d = average(
    dailyRows.slice(-14).map((row) => row.avgEdgeBps)
  );

  const edge45d = average(edges);

  const latestClosedTradeAt =
    closedTrades.at(-1)?.exitAt ?? null;

  return {
    performance: {
      trades: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRatePct:
        closedTrades.length > 0
          ? (wins.length / closedTrades.length) * 100
          : null,
      avgEdgeBps: edge45d,
      grossPnlUsd,
      avgWinBps: average(winningEdges),
      avgLossBps: average(losingEdges),
      hardStops,
      trailStops,
      latestClosedTradeAt,
      freshness: getFreshness(latestClosedTradeAt),
    },

    trend: {
      todayEdgeBps: latestDaily?.avgEdgeBps ?? null,
      edge7dBps: edge7d,
      edge14dBps: edge14d,
      edge45dBps: edge45d,
      direction: classifyTrend(edge7d, edge14d),
      sampleSize: closedTrades.length,
    },
  };
}