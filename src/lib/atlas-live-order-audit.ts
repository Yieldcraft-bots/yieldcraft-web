/**
 * ============================================================
 * YieldCraft Atlas
 * Live Order Audit
 *
 * PURPOSE
 * Create audit records for Atlas live execution outcomes.
 *
 * SAFETY
 * - No Coinbase calls
 * - No execution decisions
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only creates audit records.
 * ============================================================
 */

export type AtlasLiveOrderAuditStatus =
  | "RESERVED"
  | "SUBMITTED"
  | "SETTLED"
  | "FAILED"
  | "BLOCKED";


export interface AtlasLiveOrderAudit {
  createdAt: string;

  status: AtlasLiveOrderAuditStatus;

  userId: string;

  authorizationId: string;

  portfolioPlanId: string;

  productId: string;

  quoteSizeUsd: number;

  coinbaseOrderId: string | null;

  responseSummary: string;
}


export function createAtlasLiveOrderAudit(
  input: Omit<
    AtlasLiveOrderAudit,
    "createdAt"
  >
): AtlasLiveOrderAudit {

  return {
    createdAt:
      new Date().toISOString(),

    ...input,
  };
}