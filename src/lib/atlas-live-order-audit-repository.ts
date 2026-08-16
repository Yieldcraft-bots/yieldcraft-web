/**
 * ============================================================
 * YieldCraft Atlas
 * Live Order Audit Repository
 *
 * PURPOSE
 * Persistence boundary for Atlas live execution audit records.
 *
 * SAFETY
 * - No execution logic
 * - No Coinbase calls
 * - No order decisions
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only stores and retrieves audit records.
 * ============================================================
 */


import type {
  AtlasLiveOrderAudit,
} from "./atlas-live-order-audit";



export interface AtlasLiveOrderAuditRepository {

  create(
    audit: AtlasLiveOrderAudit
  ): Promise<void>;


  listByUser(
    userId: string
  ): Promise<AtlasLiveOrderAudit[]>;

}