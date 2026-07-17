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

export interface AtlasHealthCheck {
  name: string;
  healthy: boolean;
  description: string;
}

export interface AtlasOperationsStatus {
  generatedAt: string;
  regression: AtlasRegressionSummary;
  health: AtlasHealthCheck[];
}

export function getAtlasOperationsStatus(): AtlasOperationsStatus {
  const regression = runRegressionSuite();

  return {
    generatedAt: new Date().toISOString(),
    regression,
    health: [
      {
        name: "Atlas Labs",
        healthy: regression.passed,
        description: "Regression framework",
      },
      {
        name: "Regression Validation",
        healthy: regression.passed,
        description: "Latest validation results",
      },
      {
        name: "Operations Snapshot",
        healthy: true,
        description: "Snapshot generated successfully",
      },
      {
        name: "Operations API",
        healthy: true,
        description: "Read-only status service",
      },
    ],
  };
}