import "server-only";

import type {
  CandidateCapability,
  EdgeCandidate,
  EdgeDecisionState,
  EdgeDirection,
} from "./types";
import { createEdgeIntelligenceReadClient } from "./supabaseReadClient";

type PromotionBoardRow = {
  product_id?: string | null;
  signal?: string | null;
  regime?: string | null;
  structure?: string | null;
  minutes?: number | string | null;
  samples?: number | string | null;
  avg_edge_bps?: number | string | null;
  win_rate_pct?: number | string | null;
  promotion_status?: string | null;
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

function toInteger(value: unknown): number {
  const parsed = toNumber(value);

  if (parsed === null) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

/**
 * Research classification only.
 *
 * This does NOT grant Pulse execution capability.
 * Signal names are used only to organize candidates for the operator console.
 */
function inferDirection(signal: string): EdgeDirection {
  const normalized = signal.trim().toUpperCase();

  if (
    normalized.includes("SHORT") ||
    normalized.startsWith("SELL_") ||
    normalized === "SELL"
  ) {
    return "SHORT";
  }

  if (
    normalized.includes("LONG") ||
    normalized.startsWith("BUY_") ||
    normalized === "BUY"
  ) {
    return "LONG";
  }

  if (
    normalized.includes("AVOID") ||
    normalized.includes("NO_TRADE") ||
    normalized.includes("DO_NOT_TRADE")
  ) {
    return "AVOID";
  }

  return "NEUTRAL";
}

function inferCapability(direction: EdgeDirection): CandidateCapability {
  if (direction === "SHORT") {
    return "RESEARCH_ONLY";
  }

  if (direction === "LONG") {
    return "SUPPORTED";
  }

  return "UNKNOWN";
}

function mapPromotionStatus(status: string | null): EdgeDecisionState {
  if (!status) {
    return "UNKNOWN";
  }

  const normalized = status.trim().toUpperCase();

  if (normalized.includes("PROMOTION_READY")) {
    return "PROMOTION_READY";
  }

  if (
    normalized.includes("SHADOW_READY") ||
    normalized === "SHADOW"
  ) {
    return "SHADOW_READY";
  }

  if (normalized.includes("CANDIDATE")) {
    return "CANDIDATE";
  }

  if (
    normalized.includes("DEGRAD") ||
    normalized.includes("ROLLBACK")
  ) {
    return "DEGRADING";
  }

  if (
    normalized.includes("WATCH") ||
    normalized.includes("OBSERVE")
  ) {
    return "WATCH";
  }

  if (
    normalized.includes("NO_EDGE") ||
    normalized.includes("NO EDGE") ||
    normalized.includes("REJECT")
  ) {
    return "NO_EDGE";
  }

  return "UNKNOWN";
}

function buildNotes(
  direction: EdgeDirection,
  capability: CandidateCapability
): string[] {
  const notes: string[] = [];

  if (direction === "SHORT") {
    notes.push(
      "Short-side classification is research-only and does not enable short execution."
    );
  }

  if (capability === "RESEARCH_ONLY") {
    notes.push(
      "Candidate may be measured and validated, but Pulse execution capability is not enabled."
    );
  }

  if (direction === "NEUTRAL") {
    notes.push(
      "Direction could not be safely inferred from the existing signal name."
    );
  }

  return notes;
}

export async function readEdgeCandidates(): Promise<EdgeCandidate[]> {
  const client = createEdgeIntelligenceReadClient();

  const { data, error } = await client
    .from("edge_promotion_board_v1")
    .select(
      "product_id, signal, regime, structure, minutes, samples, avg_edge_bps, win_rate_pct, promotion_status"
    )
    .order("avg_edge_bps", { ascending: false });

  if (error) {
    throw new Error(`edge_candidate_read_failed: ${error.message}`);
  }

  const rows = (data ?? []) as PromotionBoardRow[];

  return rows.map((row) => {
    const signal = row.signal?.trim() || "UNKNOWN";
    const direction = inferDirection(signal);
    const capability = inferCapability(direction);

    return {
      productId: row.product_id?.trim() || "UNKNOWN",
      signal,
      direction,
      regime: row.regime?.trim() || "UNKNOWN",
      structure: row.structure?.trim() || "UNKNOWN",
      minutes: toNumber(row.minutes),
      samples: toInteger(row.samples),
      avgEdgeBps: toNumber(row.avg_edge_bps),
      winRatePct: toNumber(row.win_rate_pct),
      promotionStatus: row.promotion_status?.trim() || null,
      decisionState: mapPromotionStatus(row.promotion_status ?? null),
      capability,
      notes: buildNotes(direction, capability),
    };
  });
}