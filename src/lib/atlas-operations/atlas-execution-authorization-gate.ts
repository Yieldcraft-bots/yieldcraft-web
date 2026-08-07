/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Gate
 * ------------------------------------------------------------
 * PURPOSE
 * Determine whether an execution authorization contract has
 * reached an approved authorization state.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read only
 * - No Coinbase
 * - No orders
 * - No execution
 * - No API
 * - No database
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * This gate does not authorize orders.
 * It only verifies authorization state.
 * ============================================================
 */

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";

import {
  validateAtlasExecutionAuthorization,
} from "./atlas-execution-authorization-validator";

export type AtlasExecutionAuthorizationGateResult = {
  authorized: boolean;
  reason: string;
};

export function evaluateAtlasExecutionAuthorizationGate(
  authorization: AtlasExecutionAuthorizationContract
): AtlasExecutionAuthorizationGateResult {
  const validation =
    validateAtlasExecutionAuthorization(
      authorization
    );

  if (!validation.valid) {
    return {
      authorized: false,
      reason: validation.reason,
    };
  }

  if (authorization.status !== "AUTHORIZED") {
    return {
      authorized: false,
      reason:
        "Execution authorization is not in authorized status.",
    };
  }

  return {
    authorized: true,
    reason:
      "Execution authorization is valid and authorized.",
  };
}