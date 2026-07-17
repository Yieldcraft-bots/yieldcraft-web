/**
 * ============================================================
 * Atlas Operations
 * Operations Status
 * ------------------------------------------------------------
 * PURPOSE
 * Produce a single read-only snapshot of Atlas Operations.
 *
 * Single Responsibility:
 * Aggregate Atlas Intelligence and Atlas Labs into one
 * operations status object.
 *
 * This file performs NO business logic.
 * This file performs NO execution.
 * This file performs NO persistence.
 * This file performs NO trading.
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
 * ============================================================
 */

import { runRegressionSuite } from "../atlas-labs";
import type { AtlasRegressionSummary } from "../atlas-labs";

export interface AtlasOperationsStatus {
  generatedAt: string;
  regression: AtlasRegressionSummary;
}

export function getAtlasOperationsStatus(): AtlasOperationsStatus {
  return {
    generatedAt: new Date().toISOString(),
    regression: runRegressionSuite(),
  };
}