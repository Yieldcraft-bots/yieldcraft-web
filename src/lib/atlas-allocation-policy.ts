/**
 * Atlas Allocation Policy
 *
 * Single responsibility:
 * Given available cash and Atlas policy settings,
 * determine how much Atlas should buy.
 *
 * This file knows NOTHING about:
 * - Coinbase
 * - Supabase
 * - JWT
 * - Users
 * - Orders
 * - API Routes
 */

export type AtlasAllocationInput = {
  availableCash: number;
  deployPct: number;
  minCash: number;
  minBuy: number;
  hardCap?: number;
};

export type AtlasAllocationResult = {
  eligible: boolean;
  reason: "below_min_cash" | "atlas_policy_allocation";
  proposedBuyUsd: number;
  remainingCashUsd: number;
  calculatedBuyUsd: number;
};

function money(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateAtlasAllocation(
  input: AtlasAllocationInput
): AtlasAllocationResult {
  const availableCash = money(input.availableCash);
  const deployPct = input.deployPct;
  const minCash = input.minCash;
  const minBuy = input.minBuy;
  const hardCap = input.hardCap || 0;

  if (availableCash < minCash) {
    return {
      eligible: false,
      reason: "below_min_cash",
      proposedBuyUsd: 0,
      remainingCashUsd: availableCash,
      calculatedBuyUsd: 0,
    };
  }

  const rawBuy = availableCash * (deployPct / 100);
  const cappedBuy = hardCap > 0 ? Math.min(rawBuy, hardCap) : rawBuy;
  const flooredBuy = Math.max(cappedBuy, minBuy);
  const finalBuy = Math.min(flooredBuy, availableCash);
  const roundedBuy = money(finalBuy);

  return {
    eligible: true,
    reason: "atlas_policy_allocation",
    proposedBuyUsd: roundedBuy,
    remainingCashUsd: money(availableCash - roundedBuy),
    calculatedBuyUsd: money(rawBuy),
  };
}