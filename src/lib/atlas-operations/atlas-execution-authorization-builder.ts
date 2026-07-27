/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Builder
 * ------------------------------------------------------------
 * PURPOSE
 * Create execution authorization contracts from approved
 * governance references.
 *
 * SAFETY
 * - Contract creation only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 * - No database
 *
 * This file creates authorization state only.
 * It does not authorize orders.
 * ============================================================
 */

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";

export function buildAtlasExecutionAuthorizationContract(
  approvalId: string,
  userId: string,
  portfolioPlanId: string,
  reason: string
): AtlasExecutionAuthorizationContract {
  const now = new Date().toISOString();

  return {
    authorizationId: crypto.randomUUID(),

    approvalId,

    userId,

    portfolioPlanId,

    status: "PENDING",

    authorizedAt: null,

    createdAt: now,

    reason,
  };
}