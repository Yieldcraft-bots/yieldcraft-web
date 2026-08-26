/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Submitted Live Order Reconciler
 * ------------------------------------------------------------
 * PURPOSE
 * Reconcile an already-submitted Atlas Multi-Asset Coinbase
 * order after Coinbase has had time to settle it.
 *
 * FLOW
 * - Load existing SUBMITTED execution audit
 * - Load the exact persisted portfolio plan
 * - Resolve the authorized asset symbol from that plan
 * - GET authoritative Coinbase order state
 * - Require settled + positive filled_value
 * - Atomically consume actual filled USD AND mark execution
 *   SETTLED in one PostgreSQL transaction
 *
 * SAFETY
 * - NO order submission
 * - NO Coinbase mutation
 * - NO new execution reservation
 * - NO approval mutation
 * - NO authorization mutation
 * - NO portfolio-plan mutation
 * - NO SELL logic
 * - Multi-Asset pending state only
 * - Exactly-once settlement boundary
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  SupabaseAtlasLiveOrderAuditRepository,
} from "./supabase-atlas-live-order-audit-repository";

import {
  reconcileAtlasLiveCoinbaseOrder,
} from "./atlas-live-order-reconciliation";

import {
  loadAtlasPortfolioPlan,
} from "./repositories/atlasPortfolioPlanRepository";

import {
  settleAtlasLiveExecutionAtomically,
} from "./atlas-live-atomic-settlement-repository";


export type AtlasSubmittedOrderReconciliationResult = {
  ok: boolean;

  status:
    | "settled"
    | "waiting"
    | "blocked";

  reason: string;

  executionKey: string;

  userId: string | null;

  authorizationId: string | null;

  portfolioPlanId: string | null;

  productId: string | null;

  symbol: string | null;

  coinbaseOrderId: string | null;

  requestedQuoteSizeUsd: number;

  filledValueUsd: number;

  reconciliation: unknown;

  pendingSettlement: unknown;
};


function normalize(
  value: string
): string {

  return value
    .trim();
}


function normalizeSymbol(
  value: string
): string {

  return value
    .trim()
    .toUpperCase();
}


function finiteMoney(
  value: unknown
): number {

  const numberValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return 0;
  }


  return Number(
    numberValue.toFixed(8)
  );
}


export async function reconcileAtlasSubmittedLiveOrder(
  executionKeyInput: string
): Promise<AtlasSubmittedOrderReconciliationResult> {

  const executionKey =
    normalize(
      executionKeyInput
    );


  if (!executionKey) {
    throw new Error(
      "atlas_submitted_reconciliation_execution_key_missing"
    );
  }


  /*
   * ========================================================
   * 1. LOAD EXISTING SUBMITTED EXECUTION
   * ========================================================
   *
   * No reservation.
   * No Coinbase submission.
   */

  const auditRepository =
    new SupabaseAtlasLiveOrderAuditRepository();


  const submittedExecution =
    await auditRepository
      .loadSubmittedExecution(
        executionKey
      );


  if (!submittedExecution) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "submitted_execution_not_found_or_already_reconciled",

      executionKey,

      userId:
        null,

      authorizationId:
        null,

      portfolioPlanId:
        null,

      productId:
        null,

      symbol:
        null,

      coinbaseOrderId:
        null,

      requestedQuoteSizeUsd:
        0,

      filledValueUsd:
        0,

      reconciliation:
        null,

      pendingSettlement:
        null,
    };
  }


  /*
   * ========================================================
   * 2. LOAD EXACT PERSISTED PLAN
   * ========================================================
   */

  const storedPlan =
    await loadAtlasPortfolioPlan(
      submittedExecution.portfolioPlanId
    );


  if (!storedPlan) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "portfolio_plan_not_found",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol:
        null,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd:
        0,

      reconciliation:
        null,

      pendingSettlement:
        null,
    };
  }


  if (
    storedPlan.userId !==
    submittedExecution.userId
  ) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "portfolio_plan_user_mismatch",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol:
        null,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd:
        0,

      reconciliation:
        null,

      pendingSettlement:
        null,
    };
  }


  const matchingOrders =
    storedPlan.plan.orders
      .filter(
        (
          order
        ) =>
          order.executable ===
            true &&
          order.productId ===
            submittedExecution.productId
      );


  if (
    matchingOrders.length !==
    1
  ) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        matchingOrders.length ===
          0
          ? "authorized_plan_instruction_not_found"
          : "authorized_plan_instruction_not_unique",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol:
        null,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd:
        0,

      reconciliation:
        null,

      pendingSettlement:
        null,
    };
  }


  const authorizedOrder =
    matchingOrders[0];


  const symbol =
    normalizeSymbol(
      authorizedOrder.symbol
    );


  if (!symbol) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "authorized_plan_symbol_missing",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol:
        null,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd:
        0,

      reconciliation:
        null,

      pendingSettlement:
        null,
    };
  }


  /*
   * ========================================================
   * 3. AUTHORITATIVE COINBASE RECONCILIATION
   * ========================================================
   *
   * GET only.
   */

  const reconciliation =
    await reconcileAtlasLiveCoinbaseOrder({
      userId:
        submittedExecution.userId,

      orderId:
        submittedExecution.coinbaseOrderId,

      expectedProductId:
        submittedExecution.productId,
    });


  if (!reconciliation.confirmed) {
    return {
      ok: true,

      status:
        "waiting",

      reason:
        reconciliation.reason,

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd:
        reconciliation.filledValueUsd,

      reconciliation,

      pendingSettlement:
        null,
    };
  }


  const filledValueUsd =
    finiteMoney(
      reconciliation.filledValueUsd
    );


  if (
    filledValueUsd <=
    0
  ) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "confirmed_fill_value_invalid",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd,

      reconciliation,

      pendingSettlement:
        null,
    };
  }


  /*
   * ========================================================
   * 4. EXACTLY-ONCE ATOMIC SETTLEMENT
   * ========================================================
   *
   * ONE PostgreSQL transaction:
   *
   * - locks exact SUBMITTED execution_key
   * - verifies Coinbase order ID
   * - verifies product ID
   * - locks exact client's asset pending bucket
   * - subtracts actual authoritative filled_value
   * - transitions SAME execution SUBMITTED -> SETTLED
   *
   * Either everything commits or nothing commits.
   */

  const pendingSettlement =
    await settleAtlasLiveExecutionAtomically({
      executionKey,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      expectedProductId:
        submittedExecution.productId,

      assetSymbol:
        symbol,

      filledValueUsd,
    });


  /*
   * Another reconciliation request may have won the
   * execution-row lock and settled this exact fill first.
   *
   * In that case settled=false and NO second subtraction
   * occurs.
   */

  if (!pendingSettlement.settled) {
    return {
      ok: false,

      status:
        "blocked",

      reason:
        "execution_already_settled_or_atomic_settlement_blocked",

      executionKey,

      userId:
        submittedExecution.userId,

      authorizationId:
        submittedExecution.authorizationId,

      portfolioPlanId:
        submittedExecution.portfolioPlanId,

      productId:
        submittedExecution.productId,

      symbol,

      coinbaseOrderId:
        submittedExecution.coinbaseOrderId,

      requestedQuoteSizeUsd:
        submittedExecution.quoteSizeUsd,

      filledValueUsd,

      reconciliation,

      pendingSettlement,
    };
  }


  return {
    ok: true,

    status:
      "settled",

    reason:
      "coinbase_order_filled_and_pending_settled",

    executionKey,

    userId:
      submittedExecution.userId,

    authorizationId:
      submittedExecution.authorizationId,

    portfolioPlanId:
      submittedExecution.portfolioPlanId,

    productId:
      submittedExecution.productId,

    symbol,

    coinbaseOrderId:
      submittedExecution.coinbaseOrderId,

    requestedQuoteSizeUsd:
      submittedExecution.quoteSizeUsd,

    filledValueUsd,

    reconciliation,

    pendingSettlement,
  };
}