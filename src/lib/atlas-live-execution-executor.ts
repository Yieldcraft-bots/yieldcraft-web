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
 * - Requires deterministic execution fingerprint
 * - Atomically reserves execution before Coinbase submission
 * - Finalizes the same reservation after Coinbase response
 * - Uses the authorization userId to resolve that client's
 *   Atlas-scoped Coinbase credentials
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
} from "./atlas-live-coinbase-credentials";

import {
  createAtlasLiveOrderAudit,
} from "./atlas-live-order-audit";

import {
  SupabaseAtlasLiveOrderAuditRepository,
} from "./supabase-atlas-live-order-audit-repository";

import {
  extractCoinbaseOrderId,
} from "./coinbase-order-builder";


export interface AtlasLiveExecutionExecutorResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


function extractAtlasCoinbaseOrderId(
  response: unknown
): string | null {

  if (
    typeof response !== "object" ||
    response === null
  ) {
    return null;
  }


  const rawCoinbaseResponse =
    Reflect.get(
      response,
      "coinbase"
    );


  return extractCoinbaseOrderId(
    rawCoinbaseResponse
  );
}


async function persistAtlasLiveAudit(
  audit: ReturnType<
    typeof createAtlasLiveOrderAudit
  >
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

        reason:
          gateway.reason,
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


  /*
   * Credentials are obtained before reservation.
   *
   * IMPORTANT:
   * Credentials are resolved using the SAME userId
   * contained in the validated execution authorization.
   *
   * This binds:
   *
   * authorization.userId
   * -> that user's Atlas-scoped Coinbase credentials
   *
   * A credential failure does not consume the execution
   * reservation because no Coinbase submission was possible.
   */
  let credentials;


  try {

    credentials =
      await getAtlasLiveCoinbaseCredentials(
        authorization.userId
      );

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


  /*
   * Atomic execution reservation.
   *
   * The database UNIQUE constraint on execution_key means
   * only one request may reserve this exact execution.
   *
   * This happens BEFORE Coinbase submission.
   */
  const auditRepository =
    new SupabaseAtlasLiveOrderAuditRepository();


  const reservation =
    await auditRepository.reserveExecution({
      executionKey:
        fingerprint,

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
    });


  if (!reservation.reserved) {
    return {
      success: false,
      submitted: false,

      response: {
        mode: "live",

        fingerprint,

        authorizationId:
          authorization.authorizationId,

        reason:
          "duplicate_live_execution_blocked",
      },
    };
  }


  /*
   * Only the request that successfully reserved the
   * execution may cross the Coinbase submission boundary.
   */
  const coinbaseResult =
    await submitAtlasLiveCoinbaseOrder(
      instruction,
      credentials,
      authorization.userId
    );


  const coinbaseOrderId =
    extractAtlasCoinbaseOrderId(
      coinbaseResult.response
    );


  const finalStatus =
    coinbaseResult.submitted
      ? "SUBMITTED"
      : "FAILED";


  const responseSummary =
    coinbaseResult.submitted
      ? "coinbase_order_submitted"
      : "coinbase_order_failed";


  /*
   * Finalize the exact reservation that permitted
   * the Coinbase request.
   */
  await auditRepository.finalizeExecution({
    executionKey:
      fingerprint,

    status:
      finalStatus,

    coinbaseOrderId,

    responseSummary,
  });


  const audit =
    createAtlasLiveOrderAudit({
      status:
        finalStatus,

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

      responseSummary,
    });


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