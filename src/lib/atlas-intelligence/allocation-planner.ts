/**
 * ============================================================
 * Allocation Planner
 * ------------------------------------------------------------
 * PURPOSE
 * Convert an Atlas recommendation into a recommended
 * dollar allocation using the current Atlas policy.
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

import type { SupportedAsset } from "./types";

export interface AllocationPlannerInput {
  asset: SupportedAsset;
  availableCash: number;
  deployPct: number;
  minBuy: number;
  maxBuy?: number;
}

export interface AllocationPlannerResult {
  asset: SupportedAsset;
  recommendedAmountUsd: number;
  eligible: boolean;
  reason: string;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function buildAllocationPlan(
  input: AllocationPlannerInput
): AllocationPlannerResult {
  if (
    input.availableCash < 0 ||
    input.deployPct < 0 ||
    input.minBuy < 0 ||
    (input.maxBuy !== undefined && input.maxBuy < 0)
  ) {
    return {
      asset: input.asset,
      recommendedAmountUsd: 0,
      eligible: false,
      reason:
        "Atlas allocation policy contains an invalid negative value.",
    };
  }

  if (
    input.maxBuy !== undefined &&
    input.maxBuy < input.minBuy
  ) {
    return {
      asset: input.asset,
      recommendedAmountUsd: 0,
      eligible: false,
      reason:
        "Maximum buy amount is below the minimum buy amount.",
    };
  }

  const rawAmount = roundMoney(
    input.availableCash *
      (input.deployPct / 100)
  );

  /*
   * A minimum order is a floor for EXECUTABILITY,
   * not permission to increase the deployment policy.
   *
   * Example:
   * $25 cash × 20% = $5.
   * If minBuy is $10, Atlas waits rather than silently
   * doubling the intended deployment percentage.
   */
  if (rawAmount < input.minBuy) {
    return {
      asset: input.asset,
      recommendedAmountUsd: 0,
      eligible: false,
      reason:
        "Calculated allocation is below the minimum buy amount.",
    };
  }

  const cappedAmount =
    input.maxBuy !== undefined
      ? Math.min(rawAmount, input.maxBuy)
      : rawAmount;

  const recommendedAmount =
    roundMoney(cappedAmount);

  if (
    recommendedAmount >
    input.availableCash
  ) {
    return {
      asset: input.asset,
      recommendedAmountUsd: 0,
      eligible: false,
      reason:
        "Insufficient available cash.",
    };
  }

  return {
    asset: input.asset,
    recommendedAmountUsd:
      recommendedAmount,
    eligible: true,
    reason:
      "Atlas policy allocation calculated.",
  };
}