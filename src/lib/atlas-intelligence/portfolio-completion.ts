/**
 * ============================================================
 * Portfolio Completion Calculator
 * ------------------------------------------------------------
 * PURPOSE
 * Calculate portfolio completion statistics.
 *
 * This file contains NO execution logic.
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

export interface PortfolioCompletionInput {
  targetAssetCount: number;
  ownedAssetCount: number;
}

export interface PortfolioCompletionResult {
  completionPct: number;
  remainingAssets: number;
  complete: boolean;
}

export function calculatePortfolioCompletion(
  input: PortfolioCompletionInput
): PortfolioCompletionResult {
  const total = Math.max(input.targetAssetCount, 0);
  const owned = Math.min(
    Math.max(input.ownedAssetCount, 0),
    total
  );

  const completionPct =
    total === 0
      ? 100
      : Number(((owned / total) * 100).toFixed(1));

  return {
    completionPct,
    remainingAssets: total - owned,
    complete: owned === total,
  };
}