/**
 * ============================================================
 * Atlas Operations
 * Approval Transition
 * ------------------------------------------------------------
 * PURPOSE
 * Perform safe approval status transitions.
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
  AtlasApprovalStatus,
} from "./atlas-approval-contract";

function canTransition(
  current: AtlasApprovalStatus,
  next: AtlasApprovalStatus
): boolean {
  if (current === "PENDING") {
    return (
      next === "APPROVED" ||
      next === "REJECTED"
    );
  }

  return false;
}

export function transitionAtlasApproval(
  approval: AtlasApprovalContract,
  nextStatus: AtlasApprovalStatus
): AtlasApprovalContract {
  if (!canTransition(approval.status, nextStatus)) {
    return approval;
  }

  return {
    ...approval,
    status: nextStatus,
    approvedAt:
      nextStatus === "APPROVED"
        ? new Date().toISOString()
        : approval.approvedAt,
  };
}