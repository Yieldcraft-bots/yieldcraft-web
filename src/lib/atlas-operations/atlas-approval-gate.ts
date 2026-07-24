/**
 * ============================================================
 * Atlas Operations
 * Approval Gate
 * ------------------------------------------------------------
 * PURPOSE
 * Determine whether an Atlas approval contract is approved
 * for future workflow progression.
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

import {
  validateAtlasApproval,
} from "./atlas-approval-validator";

export type AtlasApprovalGateResult = {
  approved: boolean;
  reason: string;
};

export function evaluateAtlasApprovalGate(
  approval: AtlasApprovalContract
): AtlasApprovalGateResult {
  const validation =
    validateAtlasApproval(approval);

  if (!validation.valid) {
    return {
      approved: false,
      reason: validation.reason,
    };
  }

  if (approval.status !== "APPROVED") {
    return {
      approved: false,
      reason: "Approval is not in approved status.",
    };
  }

  return {
    approved: true,
    reason: "Approval is valid and approved.",
  };
}