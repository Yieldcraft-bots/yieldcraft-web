/**
 * ============================================================
 * Atlas Intelligence Pipeline
 * ------------------------------------------------------------
 * PURPOSE
 * Orchestrate the Atlas Intelligence engines into one
 * complete, read-only workflow.
 *
 * This file coordinates existing modules.
 * It does NOT duplicate their business logic.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No Database
 * - No API
 * - No Orders
 * - No Trading
 * ============================================================
 */

import type { SupportedAsset } from "./types";

import {
  buildTargetPortfolio,
  type ClientSelection,
} from "./target-portfolio-engine";

import {
  analyzePortfolioGap,
  type PortfolioGapResult,
} from "./portfolio-gap-analyzer";

import {
  calculatePortfolioCompletion,
  type PortfolioCompletionResult,
} from "./portfolio-completion";

import {
  determineAssetEligibility,
  type AssetEligibility,
} from "./asset-eligibility-engine";

import {
  rankOpportunities,
  type OpportunityCandidate,
  type RankedOpportunity,
} from "./opportunity-ranking-engine";

import {
  makeAtlasDecision,
  type AtlasDecision,
} from "./atlas-decision-engine";

import {
  buildAllocationPlan,
  type AllocationPlannerResult,
} from "./allocation-planner";

import {
  buildShadowRecommendation,
  type ShadowRecommendation,
} from "./shadow-recommendation";

import {
  buildRecommendationReport,
  type RecommendationReport,
} from "./recommendation-report";

export interface AtlasIntelligencePipelineInput {
  clientSelection: ClientSelection;
  currentHoldings: SupportedAsset[];
  availableCash: number;
  deployPct: number;
  minBuy: number;
  maxBuy?: number;
}

export interface AtlasIntelligencePipelineResult {
  targetPortfolio: SupportedAsset[];
  portfolioGap: PortfolioGapResult;
  portfolioCompletion: PortfolioCompletionResult;
  rankedOpportunities: RankedOpportunity[];
  decision: AtlasDecision;
  allocationPlan: AllocationPlannerResult | null;
  shadowRecommendation: ShadowRecommendation;
  recommendationReport: RecommendationReport;
}

export function runAtlasIntelligencePipeline(
  input: AtlasIntelligencePipelineInput
): AtlasIntelligencePipelineResult {
  const targetPortfolio = buildTargetPortfolio(
    input.clientSelection
  );

  const portfolioGap = analyzePortfolioGap({
    currentHoldings: input.currentHoldings,
    targetPortfolio,
  });

  const portfolioCompletion = calculatePortfolioCompletion({
    targetAssetCount: targetPortfolio.length,
    ownedAssetCount: portfolioGap.owned.length,
  });

  const opportunityCandidates: OpportunityCandidate[] =
    portfolioGap.missing.map((asset) => {
      const eligibilityResult =
        determineAssetEligibility(asset);

      return {
        asset: eligibilityResult.asset,
        eligibility: eligibilityResult.eligibility,
      };
    });

  const rankedOpportunities = rankOpportunities(
    opportunityCandidates
  );

  const decision = makeAtlasDecision({
    rankedOpportunities,
  });

  const selectedOpportunity =
    rankedOpportunities[0] ?? null;

  const selectedEligibility: AssetEligibility =
    selectedOpportunity?.eligibility ?? "INELIGIBLE";

  const allocationPlan =
    decision.eligible &&
    decision.recommendedAsset &&
    selectedEligibility === "PRODUCTION"
      ? buildAllocationPlan({
          asset: decision.recommendedAsset,
          availableCash: input.availableCash,
          deployPct: input.deployPct,
          minBuy: input.minBuy,
          maxBuy: input.maxBuy,
        })
      : null;

  const recommendationEligible =
    decision.eligible &&
    selectedEligibility === "PRODUCTION" &&
    allocationPlan !== null &&
    allocationPlan.eligible;

  const recommendedAsset =
    selectedEligibility === "SHADOW_ONLY"
      ? decision.recommendedAsset
      : recommendationEligible
        ? decision.recommendedAsset
        : null;

  const recommendedAmountUsd = recommendationEligible
    ? allocationPlan.recommendedAmountUsd
    : 0;

  const reason =
    selectedEligibility === "SHADOW_ONLY"
      ? decision.reason
      : recommendationEligible
        ? `${decision.reason} ${allocationPlan.reason}`
        : allocationPlan?.reason ?? decision.reason;

  const shadowRecommendation = buildShadowRecommendation(
    recommendationEligible,
    recommendedAsset,
    recommendedAmountUsd,
    reason,
    selectedEligibility
  );

  const recommendationReport = buildRecommendationReport({
    asset: recommendedAsset,
    recommendedAmountUsd,
    completionPct: portfolioCompletion.completionPct,
    missingAssets: portfolioGap.missing,
    reason,
    eligible: recommendationEligible,
    eligibility: selectedEligibility,
  });

  return {
    targetPortfolio,
    portfolioGap,
    portfolioCompletion,
    rankedOpportunities,
    decision,
    allocationPlan,
    shadowRecommendation,
    recommendationReport,
  };
}