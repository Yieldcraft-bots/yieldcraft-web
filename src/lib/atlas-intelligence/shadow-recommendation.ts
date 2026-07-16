/**
 * ============================================================
 * Shadow Recommendation
 * ------------------------------------------------------------
 * PURPOSE
 * Assemble the Atlas Intelligence pipeline into a single
 * recommendation WITHOUT executing trades.
 *
 * This file is the bridge between intelligence and future
 * operations dashboards.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No API
 * - No Database
 * - No Orders
 * ============================================================
 */

import type { SupportedAsset } from "./types";

export interface ShadowRecommendation {
  eligible: boolean;
  asset: SupportedAsset | null;
  recommendedAmountUsd: number;
  reason: string;
  generatedAt: string;
}

export function buildShadowRecommendation(
  eligible: boolean,
  asset: SupportedAsset | null,
  amount: number,
  reason: string
): ShadowRecommendation {
  return {
    eligible,
    asset,
    recommendedAmountUsd: Number(amount.toFixed(2)),
    reason,
    generatedAt: new Date().toISOString(),
  };
}