/**
 * ============================================================
 * Atlas Operations
 * Approval Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Define the persistence boundary for Atlas approvals.
 *
 * This file contains NO storage implementation.
 *
 * SAFETY
 * - No Coinbase
 * - No orders
 * - No execution
 * - No API
 * - No Pulse
 * - No Recon
 * - No trading
 * ============================================================
 */

import type {
  AtlasApprovalContract,
} from "./atlas-approval-contract";


export interface AtlasApprovalRepository {
  load(
    approvalId: string,
    userId: string
  ): Promise<AtlasApprovalContract | null>;


  save(
    approval: AtlasApprovalContract
  ): Promise<void>;
}


export class InMemoryAtlasApprovalRepository
  implements AtlasApprovalRepository
{
  private readonly store =
    new Map<string, AtlasApprovalContract>();


  async load(
    approvalId: string,
    userId: string
  ): Promise<AtlasApprovalContract | null> {
    const approval =
      this.store.get(approvalId);


    if (!approval) {
      return null;
    }


    if (approval.userId !== userId) {
      return null;
    }


    return approval;
  }


  async save(
    approval: AtlasApprovalContract
  ): Promise<void> {
    this.store.set(
      approval.approvalId,
      approval
    );
  }
}