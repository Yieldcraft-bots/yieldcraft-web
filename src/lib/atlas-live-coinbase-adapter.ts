/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Adapter
 *
 * PURPOSE
 * Controlled Coinbase communication boundary for Atlas live
 * execution.
 *
 * SAFETY
 * - No approval logic
 * - No authorization logic
 * - Equity orders require authoritative Coinbase tradability
 *   and normal-session proof before submission
 * - Crypto order behavior remains unchanged
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 *
 * This adapter only communicates with Coinbase.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";

import {
  buildCoinbaseMarketBuyOrder,
} from "./coinbase-order-builder";

import {
  atlasCoinbasePost,
  type AtlasCoinbaseRequestContext,
} from "./atlas-live-coinbase-client";

import {
  evaluateAtlasEquityTradability,
} from "./atlas-equity-tradability-gate";


export interface AtlasLiveCoinbaseAdapterResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


function money(
  n: number
): string {

  return Number(
    n.toFixed(2)
  ).toFixed(2);
}


/**
 * Coinbase crypto products use readable IDs such as:
 *
 * BTC-USD
 * ETH-USD
 *
 * Coinbase equity products use canonical hashed IDs returned
 * by the EQUITY Products API.
 */
function isAtlasEquityInstruction(
  instruction: AtlasExecutionInstruction
): boolean {

  return !instruction.productId.includes("-");
}


/**
 * Build a Coinbase equity market buy for the NORMAL session.
 *
 * This payload is constructed only AFTER Coinbase's read-only
 * equity tradability gate has confirmed:
 *
 * - product_type = EQUITY
 * - trading is enabled
 * - product is not view-only
 * - product is tradable
 * - buys are enabled
 * - trading is not halted
 * - current session = EQUITY_TRADING_SESSION_NORMAL
 *
 * Atlas therefore never attempts this fractional/notional
 * market order during unsupported extended-hours sessions.
 */
function buildAtlasEquityMarketBuyOrder(
  userId: string,
  instruction: AtlasExecutionInstruction
) {

  const mode =
    process.env.ATLAS_LIVE_ARMED === "true"
      ? "live"
      : "dry_run";


  return {
    client_order_id:
      `yc_atlas_equity_${mode}_${userId.slice(0, 8)}_${Date.now()}`,

    product_id:
      instruction.productId,

    side:
      "BUY" as const,

    order_configuration: {
      market_market_ioc: {
        quote_size:
          money(
            instruction.quoteSizeUsd
          ),
      },
    },

    equity_order_metadata: {
      equity_trading_session:
        "EQUITY_TRADING_SESSION_NORMAL",

      displayed_order_config:
        "MARKET_GFD",
    },
  };
}


export async function submitAtlasLiveCoinbaseOrder(
  instruction: AtlasExecutionInstruction,
  context: AtlasCoinbaseRequestContext,
  userId: string
): Promise<AtlasLiveCoinbaseAdapterResult> {

  try {

    const isEquity =
      isAtlasEquityInstruction(
        instruction
      );


    /*
     * ========================================================
     * EQUITY PRE-SUBMISSION GATE
     * ========================================================
     *
     * This performs a separate authenticated GET against the
     * exact Coinbase equity product.
     *
     * If Coinbase cannot affirmatively prove the product is
     * currently suitable for our normal-session market order,
     * fail closed BEFORE POST /orders.
     */
    if (isEquity) {

      const tradability =
        await evaluateAtlasEquityTradability(
          userId,
          instruction.productId
        );


      if (!tradability.allowed) {

        return {
          success: false,

          submitted: false,

          response: {
            mode:
              "live",

            assetType:
              "equity",

            productId:
              instruction.productId,

            symbol:
              instruction.symbol,

            quoteSizeUsd:
              instruction.quoteSizeUsd,

            reason:
              "equity_tradability_gate_blocked",

            gateReason:
              tradability.reason,

            ticker:
              tradability.ticker,

            currentSession:
              tradability.currentSession,
          },
        };
      }
    }


    /*
     * ========================================================
     * ORDER PAYLOAD
     * ========================================================
     */

    const payload =
      isEquity
        ? buildAtlasEquityMarketBuyOrder(
            userId,
            instruction
          )
        : buildCoinbaseMarketBuyOrder(
            userId,
            instruction.productId,
            instruction.quoteSizeUsd,
            true
          );


    /*
     * ========================================================
     * COINBASE SUBMISSION
     * ========================================================
     */

    const result =
      await atlasCoinbasePost(
        context,
        "/api/v3/brokerage/orders",
        payload
      );


    if (!result.success) {

      return {
        success: false,

        submitted: false,

        response: {
          mode:
            "live",

          assetType:
            isEquity
              ? "equity"
              : "crypto",

          productId:
            instruction.productId,

          symbol:
            instruction.symbol,

          quoteSizeUsd:
            instruction.quoteSizeUsd,

          reason:
            "coinbase_order_rejected",

          status:
            result.status,

          coinbase:
            result.response,
        },
      };
    }


    return {
      success: true,

      submitted: true,

      response: {
        mode:
          "live",

        assetType:
          isEquity
            ? "equity"
            : "crypto",

        productId:
          instruction.productId,

        symbol:
          instruction.symbol,

        quoteSizeUsd:
          instruction.quoteSizeUsd,

        reason:
          "coinbase_order_submitted",

        coinbase:
          result.response,
      },
    };

  } catch (error) {

    return {
      success: false,

      submitted: false,

      response: {
        mode:
          "live",

        productId:
          instruction.productId,

        symbol:
          instruction.symbol,

        quoteSizeUsd:
          instruction.quoteSizeUsd,

        reason:
          "coinbase_adapter_error",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }
}