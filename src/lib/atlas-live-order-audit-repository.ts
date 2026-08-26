/**
 * ============================================================
 * YieldCraft Atlas
 * Live Order Audit Repository
 *
 * PURPOSE
 * Persistence boundary for Atlas live execution audit records,
 * execution reservations, and post-submission settlement.
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
 * This file only stores, reserves, finalizes,
 * reconciles, and retrieves audit records.
 * ============================================================
 */

import type {
  AtlasLiveOrderAudit,
  AtlasLiveOrderAuditStatus,
} from "./atlas-live-order-audit";


export type AtlasLiveExecutionReservationInput = {
  executionKey: string;

  userId: string;

  authorizationId: string;

  portfolioPlanId: string;

  productId: string;

  quoteSizeUsd: number;
};


export type AtlasLiveExecutionReservationResult = {
  reserved: boolean;

  reason:
    | "reserved"
    | "already_reserved";
};


export type AtlasLiveExecutionFinalizeInput = {
  executionKey: string;

  status:
    Exclude<
      AtlasLiveOrderAuditStatus,
      "RESERVED"
    >;

  coinbaseOrderId:
    string | null;

  responseSummary:
    string;
};


export type AtlasLiveSubmittedExecution = {
  executionKey: string;

  userId: string;

  authorizationId: string;

  portfolioPlanId: string;

  productId: string;

  quoteSizeUsd: number;

  coinbaseOrderId: string;

  responseSummary: string;

  createdAt: string;
};


export type AtlasLiveExecutionSettlementInput = {
  executionKey: string;

  coinbaseOrderId: string;

  responseSummary: string;
};


export interface AtlasLiveOrderAuditRepository {

  create(
    audit: AtlasLiveOrderAudit
  ): Promise<void>;


  listByUser(
    userId: string
  ): Promise<
    AtlasLiveOrderAudit[]
  >;


  reserveExecution(
    input:
      AtlasLiveExecutionReservationInput
  ): Promise<
    AtlasLiveExecutionReservationResult
  >;


  finalizeExecution(
    input:
      AtlasLiveExecutionFinalizeInput
  ): Promise<void>;


  loadSubmittedExecution(
    executionKey: string
  ): Promise<
    AtlasLiveSubmittedExecution | null
  >;


  settleSubmittedExecution(
    input:
      AtlasLiveExecutionSettlementInput
  ): Promise<void>;
}