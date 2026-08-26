/**
 * ============================================================
 * Atlas Labs
 * Expected Results
 * ------------------------------------------------------------
 * PURPOSE
 * Define the approved baseline expectations for Atlas Labs
 * regression scenarios.
 *
 * This file contains NO execution logic.
 * This file contains NO validation logic.
 * This file contains NO business logic.
 *
 * It is the single source of truth for expected outcomes.
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

export interface AtlasScenarioExpectation {
  scenarioId: string;

  /**
   * Should Atlas produce an eligible final recommendation?
   */
  expectedEligible?: boolean;

  /**
   * Expected recommended asset.
   * Use null when no recommendation is expected.
   */
  expectedAsset?: string | null;

  /**
   * Expected portfolio completion percentage.
   */
  expectedCompletionPct?: number;

  /**
   * Expected eligibility of the allocation plan.
   * Use null when no allocation plan should exist.
   */
  expectedAllocationEligible?: boolean | null;

  /**
   * Expected final recommended dollar amount.
   */
  expectedRecommendedAmountUsd?: number;

  /**
   * Expected final recommendation reason.
   */
  expectedReason?: string;
}

export const ATLAS_EXPECTED_RESULTS: readonly AtlasScenarioExpectation[] = [
  {
    scenarioId: "btc-only",
    expectedEligible: true,
    expectedAsset: "BTC",
    expectedCompletionPct: 0,
  },

  {
    scenarioId: "eth-only",
    expectedEligible: false,
    expectedAsset: "ETH",
    expectedCompletionPct: 0,
    expectedRecommendedAmountUsd: 0,
    expectedReason:
      "Highest-ranked opportunity is shadow-only.",
  },

  {
    scenarioId: "spacex-only",
    expectedEligible: false,
    expectedAsset: "SPACEX",
    expectedCompletionPct: 0,
    expectedRecommendedAmountUsd: 0,
    expectedReason:
      "Highest-ranked opportunity is shadow-only.",
  },

  {
    scenarioId: "mag7-only",
    expectedEligible: false,
    expectedAsset: "AAPL",
    expectedCompletionPct: 0,
    expectedRecommendedAmountUsd: 0,
    expectedReason:
      "Highest-ranked opportunity is shadow-only.",
  },

  {
    scenarioId: "btc-spacex",
    expectedEligible: true,
  },

  {
    scenarioId: "mixed-portfolio",
  },

  {
    scenarioId: "portfolio-complete",
    expectedEligible: false,
    expectedCompletionPct: 100,
  },

  {
    scenarioId: "no-cash",
    expectedEligible: false,
  },

  {
    scenarioId: "below-minimum-buy",
    expectedEligible: false,
  },

  {
    scenarioId: "duplicate-holdings",
  },

  {
    scenarioId: "duplicate-selection",
  },

  {
    scenarioId: "empty-selection",
    expectedEligible: false,
  },

  {
    scenarioId: "negative-deploy-policy",
    expectedEligible: false,
    expectedAsset: null,
    expectedCompletionPct: 0,
    expectedAllocationEligible: false,
    expectedRecommendedAmountUsd: 0,
    expectedReason:
      "Atlas allocation policy contains an invalid negative value.",
  },

  {
    scenarioId: "maximum-below-minimum",
    expectedEligible: false,
    expectedAsset: null,
    expectedCompletionPct: 0,
    expectedAllocationEligible: false,
    expectedRecommendedAmountUsd: 0,
    expectedReason:
      "Maximum buy amount is below the minimum buy amount.",
  },
];

export function getExpectedResult(
  scenarioId: string
): AtlasScenarioExpectation | null {
  return (
    ATLAS_EXPECTED_RESULTS.find(
      (expectation) => expectation.scenarioId === scenarioId
    ) ?? null
  );
}