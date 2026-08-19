/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Executor
 *
 * PURPOSE
 * Controlled live execution boundary for Atlas instructions.
 *
 * SAFETY
 * - Requires authorization proof
 * - Requires live gateway approval
 * - Requires idempotency fingerprint
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 *
 * This file owns live execution only.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-operations/atlas-execution-authorization-contract";

import {
  evaluateAtlasLiveExecutionGateway,
} from "./atlas-live-execution-gateway";

import {
  createAtlasExecutionFingerprint,
} from "./atlas-live-execution-idempotency";

import {
  submitAtlasLiveCoinbaseOrder,
} from "./atlas-live-coinbase-adapter";

import {
  getAtlasLiveCoinbaseCredentials,
  refreshAtlasLiveCoinbaseCredentials,
} from "./atlas-live-coinbase-credentials";

import {
  createAtlasLiveOrderAudit,
} from "./atlas-live-order-audit";

import {
  SupabaseAtlasLiveOrderAuditRepository,
} from "./supabase-atlas-live-order-audit-repository";


export interface AtlasLiveExecutionExecutorResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


function extractOrderId(
  response: unknown
): string | null {

  if (
    typeof response !== "object" ||
    response === null
  ) {
    return null;
  }


  const coinbase =
    Reflect.get(
      response,
      "coinbase"
    );


  if (
    typeof coinbase !== "object" ||
    coinbase === null
  ) {
    return null;
  }


  const orderId =
    Reflect.get(
      coinbase,
      "orderId"
    );


  return typeof orderId === "string" &&
    orderId.trim()
    ? orderId.trim()
    : null;
}


async function persistAtlasLiveAudit(
  audit: ReturnType<typeof createAtlasLiveOrderAudit>
): Promise<void> {

  const repository =
    new SupabaseAtlasLiveOrderAuditRepository();


  await repository.create(
    audit
  );
}


export async function executeAtlasLiveInstruction(
  instruction: AtlasExecutionInstruction,
  authorization: AtlasExecutionAuthorizationContract
): Promise<AtlasLiveExecutionExecutorResult> {


  const gateway =
    evaluateAtlasLiveExecutionGateway(
      authorization,
      instruction
    );


  if (!gateway.allowed) {
    return {
      success: false,
      submitted: false,
      response: {
        mode: "live",
        reason: gateway.reason,
      },
    };
  }


  const fingerprint =
    createAtlasExecutionFingerprint({
      userId:
        authorization.userId,
      authorizationId:
        authorization.authorizationId,
      productId:
        instruction.productId,
      quoteSizeUsd:
        instruction.quoteSizeUsd,
    });


  try {

    await refreshAtlasLiveCoinbaseCredentials();

  } catch (error) {

    const audit =
      createAtlasLiveOrderAudit({
        status: "BLOCKED",
        userId:
          authorization.userId,
        authorizationId:
          authorization.authorizationId,
        portfolioPlanId:
          authorization.portfolioPlanId,
        productId:
          instruction.productId,
        quoteSizeUsd:
          instruction.quoteSizeUsd,
        coinbaseOrderId:
          null,
        responseSummary:
          "coinbase_credentials_refresh_failed",
      });


    await persistAtlasLiveAudit(
      audit
    );


    return {
      success: false,
      submitted: false,
      response: {
        mode: "live",
        fingerprint,
        audit,
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }


  const credentials =
    getAtlasLiveCoinbaseCredentials();


  if (!credentials) {

    const audit =
      createAtlasLiveOrderAudit({
        status: "BLOCKED",
        userId:
          authorization.userId,
        authorizationId:
          authorization.authorizationId,
        portfolioPlanId:
          authorization.portfolioPlanId,
        productId:
          instruction.productId,
        quoteSizeUsd:
          instruction.quoteSizeUsd,
        coinbaseOrderId:
          null,
        responseSummary:
          "coinbase_credentials_missing",
      });


    await persistAtlasLiveAudit(
      audit
    );


    return {
      success: false,
      submitted: false,
      response: {
        mode: "live",
        fingerprint,
        audit,
        reason:
          "coinbase_credentials_missing",
      },
    };
  }


  const coinbaseResult =
    await submitAtlasLiveCoinbaseOrder(
      instruction,
      credentials,
      authorization.userId
    );


  const coinbaseOrderId =
    extractOrderId(
      coinbaseResult.response
    );


  const audit =
    createAtlasLiveOrderAudit({
      status:
        coinbaseResult.submitted
          ? "SUBMITTED"
          : "FAILED",

      userId:
        authorization.userId,

      authorizationId:
        authorization.authorizationId,

      portfolioPlanId:
        authorization.portfolioPlanId,

      productId:
        instruction.productId,

      quoteSizeUsd:
        instruction.quoteSizeUsd,

      coinbaseOrderId,

      responseSummary:
        coinbaseResult.submitted
          ? "coinbase_order_submitted"
          : "coinbase_order_failed",
    });


  await persistAtlasLiveAudit(
    audit
  );


  return {
    success:
      coinbaseResult.success,

    submitted:
      coinbaseResult.submitted,

    response: {
      mode: "live",
      fingerprint,
      authorizationId:
        authorization.authorizationId,
      audit,
      coinbase:
        coinbaseResult.response,
    },
  };
}