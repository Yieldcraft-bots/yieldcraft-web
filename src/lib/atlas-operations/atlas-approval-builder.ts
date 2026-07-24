/**
 * ============================================================
 * Atlas Operations
 * Approval Builder
 * ------------------------------------------------------------
 * PURPOSE
 * Create a pending approval contract from a validated
 * portfolio plan reference.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read only
 * - No Coinbase
 * - No orders
 * - No API
 * - No database
 * - No Pulse
 * - No Recon
 * - No trading
 * ============================================================
 */

import type {
  AtlasApprovalContract,
} from "./atlas-approval-contract";

export function buildAtlasApprovalContract(
  userId: string,
  portfolioPlanId: string,
  reason: string
): AtlasApprovalContract {
  const now = new Date().toISOString();

  return {
    approvalId: crypto.randomUUID(),

    userId,

    status: "PENDING",

    portfolioPlanId,

    approvedAt: null,

    createdAt: now,

    reason,
  };
}