/**
 * ============================================================
 * Opportunity Ranking Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Rank eligible opportunities for future allocation planning.
 *
 * This engine does NOT:
 * - determine eligibility
 * - make execution decisions
 * - allocate capital
 *
 * It only assigns ranking priority.
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
import type { AssetEligibility } from "./asset-eligibility-engine";

export interface RankedOpportunity {
  asset: SupportedAsset;
  eligibility: AssetEligibility;
  priority: number;
}

export interface OpportunityCandidate {
  asset: SupportedAsset;
  eligibility: AssetEligibility;
}

export function rankOpportunities(
  opportunities: OpportunityCandidate[]
): RankedOpportunity[] {
  return opportunities.map((opportunity, index) => ({
    asset: opportunity.asset,
    eligibility: opportunity.eligibility,
    priority: index + 1,
  }));
}