/**
 * ============================================================
 * Atlas Operations
 * Approval Contract
 * ------------------------------------------------------------
 * PURPOSE
 * Define the read-only approval boundary between Atlas planning
 * and future execution workflows.
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

export type AtlasApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface AtlasApprovalContract {
  approvalId: string;

  userId: string;

  status: AtlasApprovalStatus;

  portfolioPlanId: string;

  approvedAt: string | null;

  createdAt: string;

  reason: string;
}