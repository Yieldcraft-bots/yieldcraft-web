/**
 * ============================================================
 * Atlas Operations
 * Approval Service
 * ------------------------------------------------------------
 * PURPOSE
 * Orchestrate approval contract creation and validation.
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

import {
  buildAtlasApprovalContract,
} from "./atlas-approval-builder";

import {
  validateAtlasApproval,
} from "./atlas-approval-validator";

import type {
  AtlasApprovalContract,
} from "./atlas-approval-contract";

export type CreateAtlasApprovalInput = {
  userId: string;
  portfolioPlanId: string;
  reason: string;
};

export type CreateAtlasApprovalResult = {
  approval: AtlasApprovalContract;
  valid: boolean;
  reason: string;
};

export function createAtlasApproval(
  input: CreateAtlasApprovalInput
): CreateAtlasApprovalResult {
  const approval =
    buildAtlasApprovalContract(
      input.userId,
      input.portfolioPlanId,
      input.reason
    );

  const validation =
    validateAtlasApproval(approval);

  return {
    approval,
    valid: validation.valid,
    reason: validation.reason,
  };
}