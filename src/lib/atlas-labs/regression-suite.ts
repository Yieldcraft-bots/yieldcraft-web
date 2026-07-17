/**
 * ============================================================
 * Atlas Labs
 * Regression Suite
 * ------------------------------------------------------------
 * PURPOSE
 * Execute every enabled Atlas Labs scenario, validate each
 * result, and return a complete regression summary.
 *
 * Single Responsibility:
 * Coordinate scenario execution and validation.
 *
 * This file performs NO business logic.
 * This file performs NO reporting.
 * This file performs NO persistence.
 * This file performs NO execution.
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

import {
  runAllScenarios,
  type AtlasScenarioRunResult,
} from "./scenario-runner";

import {
  validateScenarioResult,
  type AtlasScenarioValidationResult,
} from "./scenario-validator";

export interface AtlasRegressionResult {
  scenario: AtlasScenarioRunResult;
  validation: AtlasScenarioValidationResult;
}

export interface AtlasRegressionSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  passed: boolean;
  results: AtlasRegressionResult[];
}

export function runRegressionSuite(): AtlasRegressionSummary {
  const runs = runAllScenarios();

  const results: AtlasRegressionResult[] = runs.map((scenario) => ({
    scenario,
    validation: validateScenarioResult(scenario),
  }));

  const passedScenarios = results.filter(
    (result) => result.validation.passed
  ).length;

  const failedScenarios = results.length - passedScenarios;

  return {
    totalScenarios: results.length,
    passedScenarios,
    failedScenarios,
    passed: failedScenarios === 0,
    results,
  };
}