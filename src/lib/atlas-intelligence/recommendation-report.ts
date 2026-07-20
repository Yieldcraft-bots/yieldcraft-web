/**
 * ============================================================
 * Recommendation Report
 * ------------------------------------------------------------
 * PURPOSE
 * Build the final read-only Atlas recommendation report.
 *
 * This report is intended for:
 * - Atlas Operations
 * - Mission Control
 * - Shadow Mode
 * - Future notifications
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
import type {
  AssetEligibility,
} from "./asset-eligibility-engine";

export interface RecommendationReportInput {
  asset: SupportedAsset | null;
  recommendedAmountUsd: number;
  completionPct: number;
  missingAssets: SupportedAsset[];
  reason: string;
  eligible: boolean;
  eligibility?: AssetEligibility;
}

export interface RecommendationReport {
  generatedAt: string;
  eligible: boolean;
  eligibility: AssetEligibility;
  recommendedAsset: SupportedAsset | null;
  recommendedAmountUsd: number;
  portfolioCompletionPct: number;
  missingAssets: SupportedAsset[];
  reason: string;
}

export function buildRecommendationReport(
  input: RecommendationReportInput
): RecommendationReport {
  return {
    generatedAt: new Date().toISOString(),
    eligible: input.eligible,
    eligibility:
      input.eligibility ??
      (input.eligible
        ? "PRODUCTION"
        : "INELIGIBLE"),
    recommendedAsset: input.asset,
    recommendedAmountUsd: Number(
      input.recommendedAmountUsd.toFixed(2)
    ),
    portfolioCompletionPct: Number(
      input.completionPct.toFixed(1)
    ),
    missingAssets: [...input.missingAssets],
    reason: input.reason,
  };
}