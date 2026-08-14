/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Audit Log
 *
 * PURPOSE
 * Record live execution events.
 *
 * SAFETY
 * - Audit only
 * - No trading logic
 * - No Coinbase calls
 * - No Pulse
 * - No Recon
 * - No execution decisions
 *
 * This file records events.
 * It does not create permission to execute.
 * ============================================================
 */

export type AtlasLiveExecutionResult =
  | "SUBMITTED"
  | "FAILED"
  | "BLOCKED";


export interface AtlasLiveExecutionLog {
  generatedAt: string;

  result: AtlasLiveExecutionResult;

  userId: string;

  authorizationId: string;

  portfolioPlanId: string;

  symbol: string;

  productId: string;

  quoteSizeUsd: number;

  orderId: string | null;

  responseSummary: string;
}


export function createAtlasLiveExecutionLog(
  input: Omit<
    AtlasLiveExecutionLog,
    "generatedAt"
  >
): AtlasLiveExecutionLog {
  return {
    generatedAt: new Date().toISOString(),
    ...input,
  };
}