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
   * Should Atlas produce an eligible recommendation?
   */
  expectedEligible?: boolean;

  /**
   * Expected recommended asset.
   * Omitted when no recommendation is expected.
   */
  expectedAsset?: string | null;

  /**
   * Expected portfolio completion percentage.
   * Optional because some scenarios intentionally
   * validate structure only.
   */
  expectedCompletionPct?: number;
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
    expectedEligible: true,
    expectedAsset: "ETH",
    expectedCompletionPct: 0,
  },

  {
    scenarioId: "spacex-only",
    expectedEligible: true,
    expectedAsset: "SPACEX",
    expectedCompletionPct: 0,
  },

  {
    scenarioId: "mag7-only",
    expectedEligible: true,
    expectedCompletionPct: 0,
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