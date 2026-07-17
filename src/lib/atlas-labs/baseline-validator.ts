/**
 * ============================================================
 * Atlas Labs
 * Baseline Validator
 * ------------------------------------------------------------
 * PURPOSE
 * Compare Atlas Intelligence results against approved
 * baseline expectations.
 *
 * Single Responsibility:
 * Validate behavioral expectations.
 *
 * This file performs NO execution.
 * This file performs NO reporting.
 * This file performs NO persistence.
 * This file performs NO business logic.
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

import { getExpectedResult } from "./expected-results";
import type { AtlasScenarioRunResult } from "./scenario-runner";

export interface AtlasBaselineValidationResult {
  passed: boolean;
  errors: string[];
}

export function validateScenarioBaseline(
  run: AtlasScenarioRunResult
): AtlasBaselineValidationResult {
  const errors: string[] = [];

  const expected = getExpectedResult(run.scenario.id);

  if (!expected) {
    return {
      passed: true,
      errors,
    };
  }

  const report = run.result.recommendationReport;

  if (
    expected.expectedEligible !== undefined &&
    report.eligible !== expected.expectedEligible
  ) {
    errors.push(
      `Expected eligible=${expected.expectedEligible} but received eligible=${report.eligible}.`
    );
  }

  if (
    expected.expectedAsset !== undefined &&
    report.recommendedAsset !== expected.expectedAsset
  ) {
    errors.push(
      `Expected asset=${expected.expectedAsset} but received asset=${report.recommendedAsset}.`
    );
  }

  if (
    expected.expectedCompletionPct !== undefined &&
    run.result.portfolioCompletion.completionPct !==
      expected.expectedCompletionPct
  ) {
    errors.push(
      `Expected completion=${expected.expectedCompletionPct}% but received ${run.result.portfolioCompletion.completionPct}%.`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}