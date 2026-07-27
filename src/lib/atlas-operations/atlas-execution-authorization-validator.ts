/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Validator
 * ------------------------------------------------------------
 * PURPOSE
 * Validate execution authorization state.
 *
 * SAFETY
 * - Validation only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 * - No database
 *
 * This validator does not authorize trades.
 * It only verifies authorization state integrity.
 * ============================================================
 */

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";

export type AtlasExecutionAuthorizationValidationResult = {
  valid: boolean;
  reason: string;
};

export function validateAtlasExecutionAuthorization(
  authorization: AtlasExecutionAuthorizationContract
): AtlasExecutionAuthorizationValidationResult {
  if (!authorization.authorizationId) {
    return {
      valid: false,
      reason: "missing_authorization_id",
    };
  }

  if (!authorization.approvalId) {
    return {
      valid: false,
      reason: "missing_approval_id",
    };
  }

  if (!authorization.userId) {
    return {
      valid: false,
      reason: "missing_user_id",
    };
  }

  if (!authorization.portfolioPlanId) {
    return {
      valid: false,
      reason: "missing_portfolio_plan_id",
    };
  }

  if (
    ![
      "PENDING",
      "AUTHORIZED",
      "REVOKED",
    ].includes(authorization.status)
  ) {
    return {
      valid: false,
      reason: "invalid_authorization_status",
    };
  }

  return {
    valid: true,
    reason: "execution authorization contract is valid.",
  };
}