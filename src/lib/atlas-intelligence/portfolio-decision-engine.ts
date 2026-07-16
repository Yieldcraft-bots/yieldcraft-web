/**
 * ============================================================
 * Atlas Intelligence
 * Portfolio Decision Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Determine which client-selected asset should receive the
 * next Atlas accumulation.
 *
 * This engine NEVER trades.
 * It NEVER creates orders.
 * It NEVER sells.
 * It NEVER modifies Atlas execution.
 *
 * It simply returns the most underweight eligible asset.
 *
 * SAFETY
 * - Read-only
 * - Pure calculation
 * - No Coinbase imports
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 * ============================================================
 */

import type {
  ValidatedClientAllocationItem,
} from "./client-allocation";

export type CurrentHolding = {
  symbol: string;
  currentValueUsd: number;
};

export type PortfolioDecisionInput = {
  allocations: readonly ValidatedClientAllocationItem[];
  holdings: readonly CurrentHolding[];
};

export type PortfolioDecisionResult = {
  symbol: string;
  targetPercent: number;
  currentPercent: number;
  allocationGap: number;
};

function normalize(symbol: string) {
  return symbol.trim().toUpperCase();
}

function round(value: number) {
  return Number(value.toFixed(2));
}

export function determineNextAccumulation(
  input: PortfolioDecisionInput
): PortfolioDecisionResult | null {

  const totalPortfolioValue =
    input.holdings.reduce(
      (sum, holding) => sum + holding.currentValueUsd,
      0
    );

  const holdingMap = new Map(
    input.holdings.map(h => [
      normalize(h.symbol),
      h.currentValueUsd,
    ])
  );

  let best: PortfolioDecisionResult | null = null;

  for (const allocation of input.allocations) {

    const currentValue =
      holdingMap.get(normalize(allocation.symbol)) ?? 0;

    const currentPercent =
      totalPortfolioValue <= 0
        ? 0
        : (currentValue / totalPortfolioValue) * 100;

    const gap =
      allocation.targetPercent - currentPercent;

    if (
      !best ||
      gap > best.allocationGap
    ) {
      best = {
        symbol: allocation.symbol,
        targetPercent: allocation.targetPercent,
        currentPercent: round(currentPercent),
        allocationGap: round(gap),
      };
    }
  }

  return best;
}