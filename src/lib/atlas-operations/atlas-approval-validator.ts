/**
 * ============================================================
 * Atlas Operations
 * Approval Validator
 * ------------------------------------------------------------
 * PURPOSE
 * Validate the structure of an Atlas approval contract.
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

export type AtlasApprovalValidationResult = {
  valid: boolean;
  reason: string;
};

export function validateAtlasApproval(
  approval: AtlasApprovalContract
): AtlasApprovalValidationResult {
  if (!approval.approvalId.trim()) {
    return {
      valid: false,
      reason: "Missing approval id.",
    };
  }

  if (!approval.userId.trim()) {
    return {
      valid: false,
      reason: "Missing user id.",
    };
  }

  if (!approval.portfolioPlanId.trim()) {
    return {
      valid: false,
      reason: "Missing portfolio plan id.",
    };
  }

  if (
    approval.status !== "PENDING" &&
    approval.status !== "APPROVED" &&
    approval.status !== "REJECTED"
  ) {
    return {
      valid: false,
      reason: "Invalid approval status.",
    };
  }

  return {
    valid: true,
    reason: "Approval contract is valid.",
  };
}