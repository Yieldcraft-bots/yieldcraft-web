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
 * - Reconciles authoritative Coinbase fill state
 * - Atomically consumes only confirmed filled pending USD
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

import {
  reconcileAtlasLiveCoinbaseOrder,
} from "./atlas-live-order-reconciliation";

import {
  SupabaseAtlasMultiAssetStateRepository,
} from "./repositories/atlasMultiAssetStateRepository";


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
   * Coinbase submission boundary.
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


  /*
   * If Coinbase did not accept the order, finalize as FAILED.
   */
  if (
    !coinbaseResult.submitted ||
    !coinbaseOrderId
  ) {

    await auditRepository.finalizeExecution({
      executionKey:
        fingerprint,

      status:
        "FAILED",

      coinbaseOrderId:
        coinbaseOrderId,

      responseSummary:
        "coinbase_order_failed",
    });


    const audit =
      createAtlasLiveOrderAudit({
        status: "FAILED",

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
          "coinbase_order_failed",
      });


    return {
      success: false,
      submitted: false,

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


  /*
   * ========================================================
   * AUTHORITATIVE FILL RECONCILIATION
   * ========================================================
   *
   * Submitted does not mean filled.
   *
   * Atlas therefore queries Coinbase for the exact order and
   * uses actual filled_value before consuming pending USD.
   */
  const reconciliation =
    await reconcileAtlasLiveCoinbaseOrder({
      userId:
        authorization.userId,

      orderId:
        coinbaseOrderId,

      expectedProductId:
        instruction.productId,
    });


  if (!reconciliation.confirmed) {

    await auditRepository.finalizeExecution({
      executionKey:
        fingerprint,

      status:
        "SUBMITTED",

      coinbaseOrderId,

      responseSummary:
        reconciliation.reason,
    });


    const audit =
      createAtlasLiveOrderAudit({
        status: "SUBMITTED",

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
          reconciliation.reason,
      });


    return {
      success: true,
      submitted: true,

      response: {
        mode: "live",

        fingerprint,

        authorizationId:
          authorization.authorizationId,

        audit,

        reconciliation,

        pendingSettlement:
          null,

        coinbase:
          coinbaseResult.response,
      },
    };
  }


  /*
   * ========================================================
   * ATOMIC PENDING SETTLEMENT
   * ========================================================
   *
   * Only actual Coinbase filled_value is consumed.
   */
  const stateRepository =
    new SupabaseAtlasMultiAssetStateRepository();


  const pendingSettlement =
    await stateRepository.consumePendingAllocation({
      userId:
        authorization.userId,

      assetSymbol:
        instruction.symbol,

      amountUsd:
        reconciliation.filledValueUsd,
    });


  if (!pendingSettlement.consumed) {

    await auditRepository.finalizeExecution({
      executionKey:
        fingerprint,

      status:
        "SUBMITTED",

      coinbaseOrderId,

      responseSummary:
        "coinbase_fill_confirmed_pending_settlement_blocked",
    });


    const audit =
      createAtlasLiveOrderAudit({
        status: "SUBMITTED",

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
          "coinbase_fill_confirmed_pending_settlement_blocked",
      });


    return {
      success: true,
      submitted: true,

      response: {
        mode: "live",

        fingerprint,

        authorizationId:
          authorization.authorizationId,

        audit,

        reconciliation,

        pendingSettlement,

        coinbase:
          coinbaseResult.response,
      },
    };
  }


  /*
   * Finalize only after:
   *
   * Coinbase accepted
   * -> Coinbase fill confirmed
   * -> exact pending dollars atomically consumed
   */
  await auditRepository.finalizeExecution({
    executionKey:
      fingerprint,

    status:
      "SUBMITTED",

    coinbaseOrderId,

    responseSummary:
      "coinbase_order_filled_and_pending_settled",
  });


  const audit =
    createAtlasLiveOrderAudit({
      status: "SUBMITTED",

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
        "coinbase_order_filled_and_pending_settled",
    });


  return {
    success: true,
    submitted: true,

    response: {
      mode: "live",

      fingerprint,

      authorizationId:
        authorization.authorizationId,

      audit,

      reconciliation,

      pendingSettlement,

      coinbase:
        coinbaseResult.response,
    },
  };
}