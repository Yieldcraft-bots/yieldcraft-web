/**
 * ============================================================
 * Opportunity Ranking Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Rank missing assets in a target portfolio.
 *
 * This engine does NOT decide trades.
 * It simply produces a prioritized list for future
 * allocation planning.
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

export interface RankedOpportunity {
  asset: SupportedAsset;
  priority: number;
}

export function rankOpportunities(
  missingAssets: SupportedAsset[]
): RankedOpportunity[] {
  return missingAssets.map((asset, index) => ({
    asset,
    priority: index + 1,
  }));
}