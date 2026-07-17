/**
 * ============================================================
 * Atlas Labs
 * Regression Suite
 * ------------------------------------------------------------
 * PURPOSE
 * Execute every enabled Atlas Labs scenario, run structural
 * and baseline validation, and return one regression summary.
 *
 * Single Responsibility:
 * Coordinate scenario execution and validation.
 *
 * This file performs NO business logic.
 * This file performs NO reporting.
 * This file performs NO persistence.
 * This file performs NO trading execution.
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

import {
  validateScenarioBaseline,
  type AtlasBaselineValidationResult,
} from "./baseline-validator";

export interface AtlasRegressionResult {
  scenario: AtlasScenarioRunResult;
  structuralValidation: AtlasScenarioValidationResult;
  baselineValidation: AtlasBaselineValidationResult;
  passed: boolean;
  errors: string[];
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

  const results: AtlasRegressionResult[] = runs.map((scenario) => {
    const structuralValidation =
      validateScenarioResult(scenario);

    const baselineValidation =
      validateScenarioBaseline(scenario);

    const errors = [
      ...structuralValidation.errors,
      ...baselineValidation.errors,
    ];

    return {
      scenario,
      structuralValidation,
      baselineValidation,
      passed:
        structuralValidation.passed &&
        baselineValidation.passed,
      errors,
    };
  });

  const passedScenarios = results.filter(
    (result) => result.passed
  ).length;

  const failedScenarios =
    results.length - passedScenarios;

  return {
    totalScenarios: results.length,
    passedScenarios,
    failedScenarios,
    passed: failedScenarios === 0,
    results,
  };
}