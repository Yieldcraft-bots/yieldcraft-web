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

  price: number | null;

  pricePercentageChange24h: number | null;

  volume24h: number | null;

  volumePercentageChange24h: number | null;

  bestBidPrice: number | null;

  bestAskPrice: number | null;

  high24h: number | null;

  low24h: number | null;

  midMarketPrice: number | null;
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


function numberValue(
  value: unknown
): number | null {

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function resultBase(
  productId: string,
  ticker: string | null,
  currentSession: string | null,
  product:
    Record<string, unknown> | null
) {

  return {
    productId,

    ticker,

    currentSession,

    price:
      product
        ? numberValue(
            product.price
          )
        : null,

    pricePercentageChange24h:
      product
        ? numberValue(
            product
              .price_percentage_change_24h
          )
        : null,

    volume24h:
      product
        ? numberValue(
            product.volume_24h
          )
        : null,

    volumePercentageChange24h:
      product
        ? numberValue(
            product
              .volume_percentage_change_24h
          )
        : null,

    bestBidPrice:
      product
        ? numberValue(
            product.best_bid_price
          )
        : null,

    bestAskPrice:
      product
        ? numberValue(
            product.best_ask_price
          )
        : null,

    high24h:
      product
        ? numberValue(
            product.high_24h
          )
        : null,

    low24h:
      product
        ? numberValue(
            product.low_24h
          )
        : null,

    midMarketPrice:
      product
        ? numberValue(
            product.mid_market_price
          )
        : null,
  };
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

      ...resultBase(
        productId,
        null,
        null,
        null
      ),
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

      ...resultBase(
        productId,
        null,
        null,
        null
      ),
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


  const market =
    resultBase(
      productId,
      ticker,
      currentSession,
      product
    );


  if (
    productType !==
    "EQUITY"
  ) {
    return {
      allowed: false,

      reason:
        "product_not_equity",

      ...market,
    };
  }


  if (tradingDisabled) {
    return {
      allowed: false,

      reason:
        "equity_trading_disabled",

      ...market,
    };
  }


  if (viewOnly) {
    return {
      allowed: false,

      reason:
        "equity_view_only",

      ...market,
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

      ...market,
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

      ...market,
    };
  }


  if (tradingHalted) {
    return {
      allowed: false,

      reason:
        "equity_trading_halted",

      ...market,
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

      ...market,
    };
  }


  return {
    allowed: true,

    reason:
      "equity_normal_session_ready",

    ...market,
  };
}