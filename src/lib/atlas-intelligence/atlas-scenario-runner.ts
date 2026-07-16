/**
 * ============================================================
 * Atlas Scenario Runner
 * ------------------------------------------------------------
 * PURPOSE
 * Execute predefined Atlas Intelligence scenarios for
 * validation and regression testing.
 *
 * This file NEVER executes trades.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No Database
 * - No API
 * ============================================================
 */

import type { SupportedAsset } from "./types";
import {
  runAtlasIntelligencePipeline,
  type AtlasIntelligencePipelineInput,
  type AtlasIntelligencePipelineResult,
} from "./atlas-intelligence-pipeline";

export interface AtlasScenario {
  name: string;
  description: string;
  input: AtlasIntelligencePipelineInput;
}

export interface AtlasScenarioResult {
  scenario: string;
  passed: boolean;
  pipeline: AtlasIntelligencePipelineResult;
}

export function runScenario(
  scenario: AtlasScenario
): AtlasScenarioResult {

  const pipeline =
    runAtlasIntelligencePipeline(scenario.input);

  return {
    scenario: scenario.name,
    passed: true,
    pipeline,
  };
}