/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Equity Tradability Gate
 *
 * PURPOSE
 * Read the authoritative Coinbase equity product state before
 * any downstream execution path considers an equity usable.
 *
 * SAFETY
 * - GET only
 * - No orders
 * - No execution
 * - No approval mutation
 * - No authorization mutation
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC
 * ============================================================
 */

import {
  atlasCoinbaseGet,
} from "./atlas-live-coinbase-client";

import {
  getAtlasCoinbaseProductCredentials,
} from "./atlas-live-coinbase-credentials";


export type AtlasEquityTradabilityResult = {
  allowed: boolean;

  reason:
    | "equity_normal_session_ready"
    | "coinbase_product_lookup_failed"
    | "product_not_equity"
    | "equity_trading_disabled"
    | "equity_view_only"
    | "equity_not_tradable"
    | "equity_buy_disabled"
    | "equity_trading_halted"
    | "equity_not_normal_session";

  productId: string;

  ticker: string | null;

  currentSession: string | null;
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


function booleanValue(
  value: unknown
): boolean {

  return value === true;
}


function stringValue(
  value: unknown
): string | null {

  return typeof value === "string"
    ? value
    : null;
}


export async function evaluateAtlasEquityTradability(
  userId: string,
  productId: string
): Promise<AtlasEquityTradabilityResult> {

  const path =
    `/api/v3/brokerage/products/${encodeURIComponent(
      productId.trim()
    )}`;


  const credentials =
    await getAtlasCoinbaseProductCredentials(
      userId,
      productId
    );


  const result =
    await atlasCoinbaseGet(
      credentials,
      path
    );


  if (!result.success) {
    return {
      allowed: false,
      reason:
        "coinbase_product_lookup_failed",
      productId,
      ticker: null,
      currentSession: null,
    };
  }


  const product =
    record(
      result.response
    );


  if (!product) {
    return {
      allowed: false,
      reason:
        "coinbase_product_lookup_failed",
      productId,
      ticker: null,
      currentSession: null,
    };
  }


  const productType =
    stringValue(
      product.product_type
    );


  const tradingDisabled =
    booleanValue(
      product.trading_disabled
    );


  const viewOnly =
    booleanValue(
      product.view_only
    );


  const details =
    record(
      product.equity_product_details
    );


  const flags =
    details
      ? record(
          details.equity_trading_flags
        )
      : null;


  const ticker =
    details
      ? stringValue(
          details.ticker
        )
      : null;


  const tradingHalted =
    details
      ? booleanValue(
          details.trading_halted
        )
      : false;


  const currentSession =
    details
      ? stringValue(
          details.current_session
        )
      : null;


  if (
    productType !==
    "EQUITY"
  ) {
    return {
      allowed: false,
      reason:
        "product_not_equity",
      productId,
      ticker,
      currentSession,
    };
  }


  if (tradingDisabled) {
    return {
      allowed: false,
      reason:
        "equity_trading_disabled",
      productId,
      ticker,
      currentSession,
    };
  }


  if (viewOnly) {
    return {
      allowed: false,
      reason:
        "equity_view_only",
      productId,
      ticker,
      currentSession,
    };
  }


  if (
    flags &&
    !booleanValue(
      flags.tradable
    )
  ) {
    return {
      allowed: false,
      reason:
        "equity_not_tradable",
      productId,
      ticker,
      currentSession,
    };
  }


  if (
    flags &&
    !booleanValue(
      flags.buy_enabled
    )
  ) {
    return {
      allowed: false,
      reason:
        "equity_buy_disabled",
      productId,
      ticker,
      currentSession,
    };
  }


  if (tradingHalted) {
    return {
      allowed: false,
      reason:
        "equity_trading_halted",
      productId,
      ticker,
      currentSession,
    };
  }


  if (
    currentSession !==
    "EQUITY_TRADING_SESSION_NORMAL"
  ) {
    return {
      allowed: false,
      reason:
        "equity_not_normal_session",
      productId,
      ticker,
      currentSession,
    };
  }


  return {
    allowed: true,
    reason:
      "equity_normal_session_ready",
    productId,
    ticker,
    currentSession,
  };
}