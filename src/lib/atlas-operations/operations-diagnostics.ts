/**
 * ============================================================
 * Atlas Operations
 * Operations Diagnostics
 * ------------------------------------------------------------
 * PURPOSE
 * Produce read-only operational diagnostics for Atlas.
 *
 * Single Responsibility:
 * Analyze the current Operations Status and identify
 * conditions that deserve operator attention.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No trading
 * - No persistence
 * - No writes
 * ============================================================
 */

import type { AtlasOperationsStatus } from "./operations-status";

export type DiagnosticSeverity =
  | "info"
  | "warning"
  | "critical";

export interface AtlasDiagnostic {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
}

export interface AtlasOperationsDiagnostics {
  generatedAt: string;
  diagnostics: AtlasDiagnostic[];
}

export function buildAtlasOperationsDiagnostics(
  status: AtlasOperationsStatus
): AtlasOperationsDiagnostics {
  const diagnostics: AtlasDiagnostic[] = [];

  if (!status.regression.passed) {
    diagnostics.push({
      id: "regression-suite",
      severity: "critical",
      title: "Regression Suite Failure",
      description:
        `${status.regression.failedScenarios} regression scenario(s) failed.`,
    });
  }

  for (const health of status.health) {
    if (!health.healthy) {
      diagnostics.push({
        id: `health-${health.name}`,
        severity: "warning",
        title: `${health.name} unhealthy`,
        description: health.description,
      });
    }
  }

  return {
    generatedAt: status.generatedAt,
    diagnostics,
  };
}