/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Execution Executor
 * ------------------------------------------------------------
 * PURPOSE
 * Controlled live Coinbase submission boundary for an already
 * approved and authorized Atlas Multi-Asset instruction.
 *
 * SAFETY
 * - Requires authorization proof
 * - Requires live gateway approval
 * - Requires shared-account product safety approval
 * - Requires deterministic execution fingerprint
 * - Atomically reserves execution before Coinbase submission
 * - Successful Coinbase submissions remain SUBMITTED
 * - Settlement is owned exclusively by the submitted-order
 *   reconciler + atomic PostgreSQL settlement transaction
 * - Uses authorization userId for Atlas-scoped Coinbase creds
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC execution controls
 * - No policy mutation
 *
 * IMPORTANT
 * This file SUBMITS.
 * It does NOT settle client pending allocation.
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
  evaluateAtlasSharedAccountSafety,
} from "./atlas-multi-asset-shared-account-safety";

import {
  createAtlasExecutionFingerprint,
} from "./atlas-live-execution-idempotency";

import {
  evaluateAtlasEquityAccumulationCooldown,
} from "./atlas-equity-accumulation-cooldown";

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

  /*
   * ========================================================
   * 1. LIVE EXECUTION GATE
   * ========================================================
   */

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
        mode:
          "live",

        reason:
          gateway.reason,
      },
    };
  }


  /*
   * ========================================================
   * 2. SHARED COINBASE ACCOUNT SAFETY GATE
   * ========================================================
   *
   * CURRENT PRODUCTION INVARIANT:
   *
   * Atlas Multi-Asset BTC-USD is blocked while Atlas and
   * Pulse share a Coinbase BTC balance.
   *
   * This prevents NEW Atlas Multi-Asset BTC accumulation from
   * entering an account-level BTC pool visible to Pulse.
   *
   * This gate:
   *
   * - does NOT modify Pulse
   * - does NOT modify legacy Atlas
   * - does NOT create SELL capability
   * - executes before Coinbase credential loading
   * - executes before reservation
   * - executes before Coinbase submission
   *
   * Non-BTC Atlas Multi-Asset instructions continue through
   * the existing execution pipeline unchanged.
   */

  const sharedAccountSafety =
    evaluateAtlasSharedAccountSafety(
      instruction.productId
    );


  if (
    !sharedAccountSafety.allowed
  ) {

    const audit =
      createAtlasLiveOrderAudit({
        status:
          "BLOCKED",

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
          sharedAccountSafety.reason,
      });


    await persistAtlasLiveAudit(
      audit
    );


    return {
      success:
        false,

      submitted:
        false,

      response: {
        mode:
          "live",

        reason:
          sharedAccountSafety.reason,

        audit,
      },
    };
  }


  /*
   * ========================================================
   * 3. DETERMINISTIC EXECUTION KEY
   * ========================================================
   */

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
   * ========================================================
   * 4. EQUITY ACCUMULATION STAGE GATE
   * ========================================================
   *
   * Equity execution-readiness mode must not repeatedly
   * accumulate the same client/product every cron cycle.
   *
   * Production launch policy:
   * - Equity only
   * - Maximum settled stages per New York market date
   * - Default = 1
   * - Crypto passes through unchanged
   * - Pending allocation remains untouched when blocked
   * - Runs before credentials
   * - Runs before reservation
   * - Runs before Coinbase submission
   *
   * The database outstanding-order invariant remains an
   * independent concurrency backstop.
   */

  const equityCooldown =
    await evaluateAtlasEquityAccumulationCooldown({
      userId:
        authorization.userId,

      productId:
        instruction.productId,
    });


  if (
    !equityCooldown.allowed
  ) {

    const audit =
      createAtlasLiveOrderAudit({
        status:
          "BLOCKED",

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
          equityCooldown.reason,
      });


    await persistAtlasLiveAudit(
      audit
    );


    return {
      success:
        false,

      submitted:
        false,

      response: {
        mode:
          "live",

        fingerprint,

        reason:
          equityCooldown.reason,

        equityCooldown,

        audit,
      },
    };
  }


  /*
   * ========================================================
   * 5. CLIENT-SCOPED COINBASE CREDENTIALS
   * ========================================================
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
        status:
          "BLOCKED",

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
        mode:
          "live",

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
        status:
          "BLOCKED",

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
        mode:
          "live",

        fingerprint,

        audit,

        reason:
          "coinbase_credentials_missing",
      },
    };
  }


  /*
   * ========================================================
   * 6. EXACTLY-ONCE EXECUTION RESERVATION
   * ========================================================
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

    /*
     * IMPORTANT:
     *
     * Return the deterministic fingerprint even when the
     * execution already exists.
     *
     * The production orchestrator can then pass this SAME
     * executionKey to reconciliation without submitting
     * another Coinbase order.
     */

    return {
      success: false,
      submitted: false,

      response: {
        mode:
          "live",

        fingerprint,

        authorizationId:
          authorization.authorizationId,

        reason:
          "duplicate_live_execution_blocked",
      },
    };
  }


  /*
   * ========================================================
   * 7. COINBASE SUBMISSION
   * ========================================================
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
   * ========================================================
   * 8. FAILED SUBMISSION
   * ========================================================
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

      coinbaseOrderId,

      responseSummary:
        "coinbase_order_failed",
    });


    const audit =
      createAtlasLiveOrderAudit({
        status:
          "FAILED",

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
        mode:
          "live",

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
   * 9. SUCCESSFUL SUBMISSION
   * ========================================================
   *
   * Coinbase accepting an order does NOT mean Atlas settles
   * client pending allocation here.
   *
   * Every accepted order becomes SUBMITTED.
   *
   * The submitted-order reconciler owns:
   *
   * Coinbase authoritative GET
   * -> filled_value confirmation
   * -> atomic pending consumption
   * -> SUBMITTED -> SETTLED
   *
   * This gives Atlas ONE settlement implementation regardless
   * of whether Coinbase fills instantly or several seconds
   * later.
   */

  await auditRepository.finalizeExecution({
    executionKey:
      fingerprint,

    status:
      "SUBMITTED",

    coinbaseOrderId,

    responseSummary:
      "coinbase_order_submitted_pending_reconciliation",
  });


  const audit =
    createAtlasLiveOrderAudit({
      status:
        "SUBMITTED",

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
        "coinbase_order_submitted_pending_reconciliation",
    });


  return {
    success: true,
    submitted: true,

    response: {
      mode:
        "live",

      fingerprint,

      authorizationId:
        authorization.authorizationId,

      audit,

      reconciliation:
        null,

      pendingSettlement:
        null,

      coinbase:
        coinbaseResult.response,
    },
  };
}