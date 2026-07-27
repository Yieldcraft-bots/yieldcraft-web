/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Orchestrator
 * ------------------------------------------------------------
 * PURPOSE
 * Coordinate approved governance state into execution
 * authorization state.
 *
 * SAFETY
 * - Authorization workflow only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 *
 * This file does not execute orders.
 * It only creates and persists authorization state.
 * ============================================================
 */

import {
  evaluateAtlasApprovalGate,
} from "./atlas-approval-gate";

import {
  buildAtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-builder";

import {
  validateAtlasExecutionAuthorization,
} from "./atlas-execution-authorization-validator";

import type {
  AtlasApprovalContract,
} from "./atlas-approval-contract";

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";

import type {
  AtlasExecutionAuthorizationRepository,
} from "./atlas-execution-authorization-repository";

export type CreateExecutionAuthorizationFromApprovalResult = {
  authorization: AtlasExecutionAuthorizationContract;
  valid: boolean;
  reason: string;
};

export async function createExecutionAuthorizationFromApproval(
  approval: AtlasApprovalContract,
  repository: AtlasExecutionAuthorizationRepository
): Promise<CreateExecutionAuthorizationFromApprovalResult> {
  const gate =
    evaluateAtlasApprovalGate(
      approval
    );

  const authorization =
    buildAtlasExecutionAuthorizationContract(
      approval.approvalId,
      approval.userId,
      approval.portfolioPlanId,
      "Execution authorization created from approved Atlas approval."
    );

  if (!gate.approved) {
    return {
      authorization,
      valid: false,
      reason: gate.reason,
    };
  }

  const validation =
    validateAtlasExecutionAuthorization(
      authorization
    );

  if (!validation.valid) {
    return {
      authorization,
      valid: false,
      reason: validation.reason,
    };
  }

  await repository.save(
    authorization
  );

  return {
    authorization,
    valid: true,
    reason:
      "Execution authorization created and persisted.",
  };
}