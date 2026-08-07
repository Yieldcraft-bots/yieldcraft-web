/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Transition
 * ------------------------------------------------------------
 * PURPOSE
 * Perform safe execution authorization status transitions.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - State transition only
 * - No Coinbase
 * - No orders
 * - No execution
 * - No API
 * - No database
 * - No Pulse
 * - No Recon
 * - No trading
 * ============================================================
 */

import type {
  AtlasExecutionAuthorizationContract,
  AtlasExecutionAuthorizationStatus,
} from "./atlas-execution-authorization-contract";

function canTransition(
  current: AtlasExecutionAuthorizationStatus,
  next: AtlasExecutionAuthorizationStatus
): boolean {
  if (current === "PENDING") {
    return (
      next === "AUTHORIZED" ||
      next === "REVOKED"
    );
  }

  if (current === "AUTHORIZED") {
    return next === "REVOKED";
  }

  return false;
}

export function transitionAtlasExecutionAuthorization(
  authorization: AtlasExecutionAuthorizationContract,
  nextStatus: AtlasExecutionAuthorizationStatus
): AtlasExecutionAuthorizationContract {
  if (!canTransition(authorization.status, nextStatus)) {
    return authorization;
  }

  return {
    ...authorization,

    status: nextStatus,

    authorizedAt:
      nextStatus === "AUTHORIZED"
        ? new Date().toISOString()
        : authorization.authorizedAt,
  };
}