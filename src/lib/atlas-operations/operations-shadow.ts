/**
 * ============================================================
 * Atlas Operations
 * Shadow Execution Snapshot
 * ------------------------------------------------------------
 * PURPOSE
 * Build a read-only shadow execution report for Atlas
 * Operations.
 *
 * This module never executes trades.
 * It never calls Coinbase.
 * It never mutates policy.
 * It only packages an already-generated bridge report for
 * presentation within Atlas Operations.
 *
 * SAFETY
 * - Read only
 * - Pure function
 * - No execution
 * - No side effects
 * ============================================================
 */

import type { AtlasExecutionBridgeResult } from "@/lib/atlas-execution-bridge";

export type AtlasOperationsShadowSnapshot = {
  generatedAt: string;
  report: AtlasExecutionBridgeResult;
};

export function buildAtlasOperationsShadowSnapshot(
  report: AtlasExecutionBridgeResult
): AtlasOperationsShadowSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    report,
  };
}