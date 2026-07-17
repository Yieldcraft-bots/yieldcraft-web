/**
 * ============================================================
 * Atlas Labs
 * Scenario Runner
 * ------------------------------------------------------------
 * PURPOSE
 * Execute one or more Atlas Labs scenarios through the
 * Atlas Intelligence Pipeline.
 *
 * Single Responsibility:
 * Run scenarios.
 *
 * This file performs NO validation.
 * This file performs NO reporting.
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
  runAtlasIntelligencePipeline,
  type AtlasIntelligencePipelineResult,
} from "../atlas-intelligence/atlas-intelligence-pipeline";

import {
  ATLAS_SCENARIOS,
  getAtlasScenarioById,
  type AtlasScenario,
} from "./scenario-catalog";

export interface AtlasScenarioRunResult {
  scenario: AtlasScenario;
  result: AtlasIntelligencePipelineResult;
}

export function runScenario(
  scenario: AtlasScenario
): AtlasScenarioRunResult {
  return {
    scenario,
    result: runAtlasIntelligencePipeline(scenario.input),
  };
}

export function runScenarioById(
  scenarioId: string
): AtlasScenarioRunResult | null {
  const scenario = getAtlasScenarioById(scenarioId);

  if (!scenario) {
    return null;
  }

  return runScenario(scenario);
}

export function runAllScenarios(): AtlasScenarioRunResult[] {
  return ATLAS_SCENARIOS.filter(
    (scenario) => scenario.enabled
  ).map(runScenario);
}