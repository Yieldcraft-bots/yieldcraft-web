/**
 * ============================================================
 * Atlas Operations
 * Approval Service
 * ------------------------------------------------------------
 * PURPOSE
 * Orchestrate approval contract creation, validation,
 * and persistence.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - No Coinbase
 * - No orders
 * - No execution
 * - No API
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * Persistence occurs only through the repository boundary.
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

import type {
  AtlasApprovalRepository,
} from "./atlas-approval-repository";

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

export async function createAtlasApproval(
  input: CreateAtlasApprovalInput,
  repository: AtlasApprovalRepository
): Promise<CreateAtlasApprovalResult> {
  const approval =
    buildAtlasApprovalContract(
      input.userId,
      input.portfolioPlanId,
      input.reason
    );

  const validation =
    validateAtlasApproval(approval);

  if (!validation.valid) {
    return {
      approval,
      valid: false,
      reason: validation.reason,
    };
  }

  await repository.save(approval);

  return {
    approval,
    valid: true,
    reason: "Approval created and persisted.",
  };
}