/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Contract
 * ------------------------------------------------------------
 * PURPOSE
 * Define authorization state between approved governance
 * and any future execution pathway.
 *
 * SAFETY
 * - Contract only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 * - No database
 *
 * This contract does NOT authorize orders.
 * It only represents permission state.
 * ============================================================
 */

export type AtlasExecutionAuthorizationStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "REVOKED";

export type AtlasExecutionAuthorizationContract = {
  authorizationId: string;

  approvalId: string;

  userId: string;

  portfolioPlanId: string;

  status: AtlasExecutionAuthorizationStatus;

  authorizedAt: string | null;

  createdAt: string;

  reason: string;
};