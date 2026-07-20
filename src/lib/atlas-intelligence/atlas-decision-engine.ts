/**
 * ============================================================
 * Atlas Decision Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Produce a single accumulation recommendation from the
 * Atlas Intelligence layer.
 *
 * This engine determines whether the highest-ranked
 * opportunity is eligible for production allocation.
 *
 * It NEVER executes trades.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No API
 * - No Database
 * ============================================================
 */

import type { SupportedAsset } from "./types";
import type { RankedOpportunity } from "./opportunity-ranking-engine";

export interface AtlasDecisionInput {
  rankedOpportunities: RankedOpportunity[];
}

export interface AtlasDecision {
  eligible: boolean;
  recommendedAsset: SupportedAsset | null;
  reason: string;
}

export function makeAtlasDecision(
  input: AtlasDecisionInput
): AtlasDecision {
  if (input.rankedOpportunities.length === 0) {
    return {
      eligible: false,
      recommendedAsset: null,
      reason: "No eligible accumulation opportunities.",
    };
  }

  const top = input.rankedOpportunities[0];

  switch (top.eligibility) {
    case "PRODUCTION":
      return {
        eligible: true,
        recommendedAsset: top.asset,
        reason: "Highest-ranked production-ready opportunity.",
      };

    case "SHADOW_ONLY":
      return {
        eligible: false,
        recommendedAsset: top.asset,
        reason: "Highest-ranked opportunity is shadow-only.",
      };

    case "INELIGIBLE":
    default:
      return {
        eligible: false,
        recommendedAsset: null,
        reason: "Highest-ranked opportunity is currently ineligible.",
      };
  }
}