/**
 * ============================================================
 * Atlas Intelligence
 * Portfolio Gap Analyzer
 * ------------------------------------------------------------
 * PURPOSE
 * Compare the assets a client currently owns against the
 * assets included in the Atlas target portfolio.
 *
 * SAFETY
 * - Read-only
 * - No trading
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 * - No Coinbase imports
 * - No database writes
 * ============================================================
 */

import type { SupportedAsset } from "./types";

export interface PortfolioGapInput {
  currentHoldings: SupportedAsset[];
  targetPortfolio: SupportedAsset[];
}

export interface PortfolioGapResult {
  owned: SupportedAsset[];
  missing: SupportedAsset[];
}

export function analyzePortfolioGap(
  input: PortfolioGapInput
): PortfolioGapResult {
  const currentHoldingSet = new Set<SupportedAsset>(
    input.currentHoldings
  );

  const owned = input.targetPortfolio.filter((asset) =>
    currentHoldingSet.has(asset)
  );

  const missing = input.targetPortfolio.filter(
    (asset) => !currentHoldingSet.has(asset)
  );

  return {
    owned,
    missing,
  };
}