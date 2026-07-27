/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Service
 * ------------------------------------------------------------
 * PURPOSE
 * Orchestrate execution authorization creation
 * and validation.
 *
 * SAFETY
 * - Authorization state only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 * - No database
 *
 * This service does not execute orders.
 * It only creates validated authorization state.
 * ============================================================
 */

import {
  validateAtlasExecutionAuthorization,
} from "./atlas-execution-authorization-validator";

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";

export type CreateExecutionAuthorizationInput = {
  authorization: AtlasExecutionAuthorizationContract;
};

export type CreateExecutionAuthorizationResult = {
  authorization: AtlasExecutionAuthorizationContract;
  valid: boolean;
  reason: string;
};

export function createAtlasExecutionAuthorization(
  input: CreateExecutionAuthorizationInput
): CreateExecutionAuthorizationResult {
  const validation =
    validateAtlasExecutionAuthorization(
      input.authorization
    );

  return {
    authorization: input.authorization,
    valid: validation.valid,
    reason: validation.reason,
  };
}