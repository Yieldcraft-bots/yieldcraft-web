/**
 * ============================================================
 * Atlas Operations
 * Operations Snapshot
 * ------------------------------------------------------------
 * PURPOSE
 * Build a single read-only snapshot for Atlas Operations.
 *
 * Single Responsibility:
 * Aggregate operational data into one dashboard-ready object.
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

import {
  getAtlasOperationsStatus,
  type AtlasOperationsStatus,
} from "./operations-status";

import {
  buildAtlasOperationsMetrics,
  type AtlasOperationsMetrics,
} from "./operations-metrics";

export interface AtlasOperationsSnapshot {
  generatedAt: string;
  overallHealthy: boolean;
  status: AtlasOperationsStatus;
  metrics: AtlasOperationsMetrics;
}

export function buildAtlasOperationsSnapshot(): AtlasOperationsSnapshot {
  const status = getAtlasOperationsStatus();
  const metrics = buildAtlasOperationsMetrics(status);

  return {
    generatedAt: status.generatedAt,
    overallHealthy: status.regression.passed,
    status,
    metrics,
  };
}