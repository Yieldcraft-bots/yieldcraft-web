/**
 * ============================================================
 * Atlas Labs
 * Scenario Validator
 * ------------------------------------------------------------
 * PURPOSE
 * Validate Atlas Labs scenario execution results.
 *
 * Single Responsibility:
 * Determine whether a scenario produced a structurally valid,
 * internally consistent pipeline result.
 *
 * This file performs NO execution.
 * This file performs NO reporting.
 * This file performs NO persistence.
 * This file performs NO business decisions.
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

import type { AtlasScenarioRunResult } from "./scenario-runner";

export interface AtlasScenarioValidationResult {
  passed: boolean;
  errors: string[];
}

export function validateScenarioResult(
  run: AtlasScenarioRunResult
): AtlasScenarioValidationResult {
  const errors: string[] = [];

  const result = run.result;

  if (!result.targetPortfolio) {
    errors.push("Missing target portfolio.");
  }

  if (!result.portfolioGap) {
    errors.push("Missing portfolio gap.");
  }

  if (!result.portfolioCompletion) {
    errors.push("Missing portfolio completion.");
  }

  if (!result.rankedOpportunities) {
    errors.push("Missing ranked opportunities.");
  }

  if (!result.decision) {
    errors.push("Missing Atlas decision.");
  }

  if (!result.shadowRecommendation) {
    errors.push("Missing shadow recommendation.");
  }

  if (!result.recommendationReport) {
    errors.push("Missing recommendation report.");
  }

  /**
   * Internal consistency checks.
   */

  if (
    result.decision.eligible &&
    result.allocationPlan === null
  ) {
    errors.push(
      "Eligible recommendation missing allocation plan."
    );
  }

  if (
    !result.decision.eligible &&
    result.allocationPlan !== null
  ) {
    errors.push(
      "Allocation plan exists for an ineligible recommendation."
    );
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}