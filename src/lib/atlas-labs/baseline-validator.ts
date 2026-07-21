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
  const allocationPlan = run.result.allocationPlan;

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

  if (
    expected.expectedAllocationEligible !== undefined
  ) {
    const actualAllocationEligible =
      allocationPlan?.eligible ?? null;

    if (
      actualAllocationEligible !==
      expected.expectedAllocationEligible
    ) {
      errors.push(
        `Expected allocation eligible=${expected.expectedAllocationEligible} but received allocation eligible=${actualAllocationEligible}.`
      );
    }
  }

  if (
    expected.expectedRecommendedAmountUsd !== undefined &&
    report.recommendedAmountUsd !==
      expected.expectedRecommendedAmountUsd
  ) {
    errors.push(
      `Expected recommended amount=${expected.expectedRecommendedAmountUsd} but received recommended amount=${report.recommendedAmountUsd}.`
    );
  }

  if (
    expected.expectedReason !== undefined &&
    report.reason !== expected.expectedReason
  ) {
    errors.push(
      `Expected reason="${expected.expectedReason}" but received reason="${report.reason}".`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}