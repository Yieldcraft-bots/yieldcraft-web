/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Order Reconciliation
 * ------------------------------------------------------------
 * PURPOSE
 * Read authoritative Coinbase order state after submission and
 * determine the actual USD notional that may be settled against
 * the isolated Multi-Asset pending allocation ledger.
 *
 * SAFETY
 * - GET only
 * - No order submission
 * - No Coinbase mutation
 * - No approval mutation
 * - No authorization mutation
 * - No pending-ledger mutation
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC modification
 *
 * IMPORTANT
 * A submitted order is NOT considered settled here merely
 * because Coinbase returned an order ID.
 *
 * Atlas requires authoritative order state and actual
 * filled_value before pending dollars may be consumed.
 * ============================================================
 */

import {
  atlasCoinbaseGet,
} from "./atlas-live-coinbase-client";

import {
  getAtlasCoinbaseOrderCredentials,
} from "./atlas-live-coinbase-credentials";


export type AtlasLiveOrderReconciliationResult = {
  confirmed: boolean;

  reason:
    | "order_fill_confirmed"
    | "coinbase_order_lookup_failed"
    | "coinbase_order_invalid"
    | "coinbase_order_id_mismatch"
    | "coinbase_product_id_mismatch"
    | "coinbase_order_not_settled"
    | "coinbase_order_no_fill";

  orderId: string;

  productId: string;

  status: string | null;

  settled: boolean;

  completionPercentage: number;

  filledSize: number;

  filledValueUsd: number;
};


function record(
  value: unknown
): Record<string, unknown> | null {

  return (
    typeof value === "object" &&
    value !== null
  )
    ? value as Record<string, unknown>
    : null;
}


function stringValue(
  value: unknown
): string | null {

  return typeof value === "string"
    ? value
    : null;
}


function finiteNumber(
  value: unknown
): number {

  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function money(
  value: number
): number {

  return Number(
    value.toFixed(8)
  );
}


export async function reconcileAtlasLiveCoinbaseOrder(
  input: {
    userId: string;
    orderId: string;
    expectedProductId: string;
  }
): Promise<AtlasLiveOrderReconciliationResult> {

  const userId =
    input.userId.trim();


  const orderId =
    input.orderId.trim();


  const expectedProductId =
    input.expectedProductId.trim();


  if (!userId) {
    throw new Error(
      "atlas_reconciliation_user_id_missing"
    );
  }


  if (!orderId) {
    throw new Error(
      "atlas_reconciliation_order_id_missing"
    );
  }


  if (!expectedProductId) {
    throw new Error(
      "atlas_reconciliation_product_id_missing"
    );
  }


  const path =
    `/api/v3/brokerage/orders/historical/${encodeURIComponent(
      orderId
    )}`;


  const credentials =
    await getAtlasCoinbaseOrderCredentials(
      userId,
      orderId
    );


  const result =
    await atlasCoinbaseGet(
      credentials,
      path
    );


  if (!result.success) {

    return {
      confirmed: false,

      reason:
        "coinbase_order_lookup_failed",

      orderId,

      productId:
        expectedProductId,

      status: null,

      settled: false,

      completionPercentage: 0,

      filledSize: 0,

      filledValueUsd: 0,
    };
  }


  const response =
    record(
      result.response
    );


  const order =
    response
      ? record(
          response.order
        )
      : null;


  if (!order) {

    return {
      confirmed: false,

      reason:
        "coinbase_order_invalid",

      orderId,

      productId:
        expectedProductId,

      status: null,

      settled: false,

      completionPercentage: 0,

      filledSize: 0,

      filledValueUsd: 0,
    };
  }


  const returnedOrderId =
    stringValue(
      order.order_id
    );


  const returnedProductId =
    stringValue(
      order.product_id
    );


  const status =
    stringValue(
      order.status
    );


  const settled =
    order.settled === true;


  const completionPercentage =
    finiteNumber(
      order.completion_percentage
    );


  const filledSize =
    finiteNumber(
      order.filled_size
    );


  const filledValueUsd =
    money(
      finiteNumber(
        order.filled_value
      )
    );


  if (
    returnedOrderId !==
    orderId
  ) {

    return {
      confirmed: false,

      reason:
        "coinbase_order_id_mismatch",

      orderId,

      productId:
        returnedProductId ??
        expectedProductId,

      status,

      settled,

      completionPercentage,

      filledSize,

      filledValueUsd,
    };
  }


  if (
    returnedProductId !==
    expectedProductId
  ) {

    return {
      confirmed: false,

      reason:
        "coinbase_product_id_mismatch",

      orderId,

      productId:
        returnedProductId ??
        expectedProductId,

      status,

      settled,

      completionPercentage,

      filledSize,

      filledValueUsd,
    };
  }


  /*
   * Fail closed until Coinbase says the order is settled.
   *
   * This handles:
   * - pending
   * - open
   * - cancellation in progress
   * - temporary asynchronous state
   */
  if (!settled) {

    return {
      confirmed: false,

      reason:
        "coinbase_order_not_settled",

      orderId,

      productId:
        returnedProductId,

      status,

      settled,

      completionPercentage,

      filledSize,

      filledValueUsd,
    };
  }


  /*
   * IOC orders may fill partially.
   *
   * Therefore we settle the actual authoritative filled_value,
   * NOT the requested quote size.
   */
  if (
    !Number.isFinite(
      filledValueUsd
    ) ||
    filledValueUsd <= 0
  ) {

    return {
      confirmed: false,

      reason:
        "coinbase_order_no_fill",

      orderId,

      productId:
        returnedProductId,

      status,

      settled,

      completionPercentage,

      filledSize,

      filledValueUsd: 0,
    };
  }


  return {
    confirmed: true,

    reason:
      "order_fill_confirmed",

    orderId,

    productId:
      returnedProductId,

    status,

    settled,

    completionPercentage,

    filledSize,

    filledValueUsd,
  };
}