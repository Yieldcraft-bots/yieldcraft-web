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
  const rawAmount =
    input.availableCash * (input.deployPct / 100);

  const cappedAmount =
    input.maxBuy !== undefined
      ? Math.min(rawAmount, input.maxBuy)
      : rawAmount;

  const recommendedAmount = roundMoney(
    Math.max(cappedAmount, input.minBuy)
  );

  if (recommendedAmount > input.availableCash) {
    return {
      asset: input.asset,
      recommendedAmountUsd: 0,
      eligible: false,
      reason: "Insufficient available cash.",
    };
  }

  return {
    asset: input.asset,
    recommendedAmountUsd: recommendedAmount,
    eligible: true,
    reason: "Atlas policy allocation calculated.",
  };
}