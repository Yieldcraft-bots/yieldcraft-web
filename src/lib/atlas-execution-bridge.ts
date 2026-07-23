/**
 * ============================================================
 * Atlas Execution Bridge
 * ------------------------------------------------------------
 * PURPOSE
 * Provide a read-only execution readiness summary from the
 * execution adapter.
 *
 * SAFETY
 * - Read-only
 * - No trading
 * - No Coinbase
 * - No Supabase
 * - No Pulse
 * - No Atlas execution
 * - No API routes
 * - No environment variables
 *
 * This bridge classifies execution readiness only.
 * It NEVER creates, modifies, or submits orders.
 * ============================================================
 */

import type {
  AtlasExecutionAdapterResult,
} from "./atlas-execution-adapter";

export type ExecutionReadiness =
  | "READY"
  | "PARTIAL"
  | "BLOCKED";

export interface AtlasExecutionBridgeResult {
  readiness: ExecutionReadiness;

  executableCount: number;
  blockedCount: number;

  blockedReasons: Record<string, number>;

  instructions: AtlasExecutionAdapterResult["instructions"];
  blocked: AtlasExecutionAdapterResult["blocked"];
}

export function buildExecutionBridgeReport(
  adapter: AtlasExecutionAdapterResult
): AtlasExecutionBridgeResult {
  const blockedReasons: Record<string, number> = {};

  for (const order of adapter.blocked) {
    blockedReasons[order.reason] =
      (blockedReasons[order.reason] ?? 0) + 1;
  }

  const executableCount = adapter.instructions.length;
  const blockedCount = adapter.blocked.length;

  let readiness: ExecutionReadiness;

  if (executableCount === 0) {
    readiness = "BLOCKED";
  } else if (blockedCount === 0) {
    readiness = "READY";
  } else {
    readiness = "PARTIAL";
  }

  return {
    readiness,
    executableCount,
    blockedCount,
    blockedReasons,
    instructions: adapter.instructions,
    blocked: adapter.blocked,
  };
}