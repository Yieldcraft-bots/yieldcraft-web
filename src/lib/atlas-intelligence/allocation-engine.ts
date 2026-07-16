/**
 * ============================================================
 * Atlas Allocation Intelligence Engine
 * ============================================================
 *
 * PURPOSE
 * Determine which approved asset is currently the most
 * underweight compared to the client's desired allocation.
 *
 * SAFETY
 * - Read-only
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 * - No Coinbase imports
 * - No Supabase imports
 * - No API routes
 *
 * This file ONLY performs allocation math.
 * It never executes trades.
 * ============================================================
 */

import type { AtlasAssetDefinition } from "./types";

export type PortfolioHolding = {
  symbol: string;
  marketValueUsd: number;
};

export type AllocationTarget = {
  symbol: string;
  targetPercent: number;
};

export type AllocationRecommendation = {
  symbol: string;
  targetPercent: number;
  currentPercent: number;
  allocationGapPercent: number;
  currentValueUsd: number;
  targetValueUsd: number;
  dollarsNeeded: number;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function rankAllocationTargets(
  portfolioValueUsd: number,
  holdings: PortfolioHolding[],
  targets: AllocationTarget[],
  assetRegistry: readonly AtlasAssetDefinition[]
): AllocationRecommendation[] {
  if (portfolioValueUsd <= 0) {
    return [];
  }

  return targets
    .map((target) => {
      const asset = assetRegistry.find(
        (a) => a.symbol === target.symbol && a.enabled
      );

      if (!asset) {
        return null;
      }

      const holding =
        holdings.find((h) => h.symbol === target.symbol) ??
        {
          symbol: target.symbol,
          marketValueUsd: 0,
        };

      const currentPercent =
        (holding.marketValueUsd / portfolioValueUsd) * 100;

      const targetValueUsd =
        portfolioValueUsd * (target.targetPercent / 100);

      const dollarsNeeded =
        targetValueUsd - holding.marketValueUsd;

      return {
        symbol: target.symbol,
        targetPercent: round(target.targetPercent),
        currentPercent: round(currentPercent),
        allocationGapPercent: round(
          target.targetPercent - currentPercent
        ),
        currentValueUsd: round(holding.marketValueUsd),
        targetValueUsd: round(targetValueUsd),
        dollarsNeeded: round(Math.max(dollarsNeeded, 0)),
      };
    })
    .filter(
      (
        recommendation
      ): recommendation is AllocationRecommendation =>
        recommendation !== null
    )
    .sort(
      (a, b) =>
        b.allocationGapPercent - a.allocationGapPercent
    );
}