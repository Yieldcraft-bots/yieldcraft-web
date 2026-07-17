/**
 * ============================================================
 * Atlas Operations
 * Operations Metrics
 * ------------------------------------------------------------
 * PURPOSE
 * Produce read-only operational metrics for Atlas Operations.
 *
 * Single Responsibility:
 * Derive dashboard metrics from the Operations Status service.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No trading
 * - No writes
 * - No persistence
 * ============================================================
 */

import { getAtlasOperationsStatus } from "./operations-status";

export interface AtlasOperationsMetrics {
  generatedAt: string;
  totalHealthChecks: number;
  healthyHealthChecks: number;
  unhealthyHealthChecks: number;
  healthPercentage: number;
  regressionPassed: boolean;
  totalRegressionScenarios: number;
  passedRegressionScenarios: number;
  failedRegressionScenarios: number;
}

export function getAtlasOperationsMetrics(): AtlasOperationsMetrics {
  const status = getAtlasOperationsStatus();

  const totalHealthChecks = status.health.length;

  const healthyHealthChecks = status.health.filter(
    (item) => item.healthy
  ).length;

  const unhealthyHealthChecks =
    totalHealthChecks - healthyHealthChecks;

  const healthPercentage =
    totalHealthChecks === 0
      ? 0
      : Math.round(
          (healthyHealthChecks / totalHealthChecks) * 100
        );

  return {
    generatedAt: status.generatedAt,

    totalHealthChecks,

    healthyHealthChecks,

    unhealthyHealthChecks,

    healthPercentage,

    regressionPassed: status.regression.passed,

    totalRegressionScenarios:
      status.regression.totalScenarios,

    passedRegressionScenarios:
      status.regression.passedScenarios,

    failedRegressionScenarios:
      status.regression.failedScenarios,
  };
}