/**
 * ============================================================
 * Portfolio Gap Analyzer
 * ------------------------------------------------------------
 * PURPOSE
 * Compare a client's current holdings against the desired
 * target portfolio and identify what is missing.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read-only
 * - No Coinbase
 * - No Pulse
 * - No Atlas execution
 * - No Recon
 * - No API
 * - No Database
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
  completionPct: number;
}

export function analyzePortfolioGap(
  input: PortfolioGapInput
): PortfolioGapResult {
  const ownedSet = new Set(input.currentHoldings);

  const owned: SupportedAsset[] = [];
  const missing: SupportedAsset[] = [];

  for (const asset of input.targetPortfolio) {
    if (ownedSet.has(asset)) {
      owned.push(asset);
    } else {
      missing.push(asset);
    }
  }

  const completionPct =
    input.targetPortfolio.length === 0
      ? 100
      : Number(
          (
            (owned.length / input.targetPortfolio.length) *
            100
          ).toFixed(1)
        );

  return {
    owned,
    missing,
    completionPct,
  };
}