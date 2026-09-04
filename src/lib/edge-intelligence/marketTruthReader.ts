import "server-only";

import type {
  MarketTruthSnapshot,
  TelemetryFreshnessState,
} from "./types";
import { createEdgeIntelligenceReadClient } from "./supabaseReadClient";

type EdgeOutcomeRow = {
  product_id?: string | null;
  regime?: string | null;
  structure?: string | null;
  volatility_bps?: number | string | null;
  outcome_15m_bps?: number | string | null;
  created_at?: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
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

  const ageMinutes = Math.max(0, (nowMs - observedMs) / 60_000);

  if (ageMinutes <= 30) {
    return "FRESH";
  }

  if (ageMinutes <= 120) {
    return "AGING";
  }

  return "STALE";
}

export async function readMarketTruth(): Promise<MarketTruthSnapshot> {
  const client = createEdgeIntelligenceReadClient();

  const { data, error } = await client
    .from("edge_outcomes")
    .select(
      "product_id, regime, structure, volatility_bps, outcome_15m_bps, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`edge_market_truth_read_failed: ${error.message}`);
  }

  const row = (data ?? null) as EdgeOutcomeRow | null;

  if (!row) {
    return {
      productId: null,
      regime: null,
      structure: null,
      volatilityBps: null,
      latestOutcome15mBps: null,
      observedAt: null,
      freshness: "UNKNOWN",
    };
  }

  const observedAt = row.created_at ?? null;

  return {
    productId: row.product_id ?? null,
    regime: row.regime ?? null,
    structure: row.structure ?? null,
    volatilityBps: toNumber(row.volatility_bps),
    latestOutcome15mBps: toNumber(row.outcome_15m_bps),
    observedAt,
    freshness: getFreshness(observedAt),
  };
}