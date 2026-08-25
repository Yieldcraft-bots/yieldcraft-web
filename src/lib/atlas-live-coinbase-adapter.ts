/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Coinbase Adapter
 *
 * PURPOSE
 * Controlled Coinbase communication boundary for
 * Atlas Multi-Asset live execution.
 *
 * SAFETY
 * - Multi-Asset only
 * - Requires ATLAS_MULTI_ASSET_LIVE_ARMED=true
 * - Requires ATLAS_MULTI_ASSET_DRY_RUN=false
 * - Independent from legacy Atlas live controls
 * - No shared legacy Atlas order builder dependency
 * - No approval logic
 * - No authorization logic
 * - Equity orders require authoritative Coinbase tradability
 *   and normal-session proof before submission
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 *
 * This adapter only communicates with Coinbase after all
 * upstream execution boundaries have already authorized the
 * instruction.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";

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
 * Multi-Asset live execution is intentionally independent
 * from legacy Atlas controls.
 *
 * Both dedicated flags are required.
 */
function multiAssetLiveEnabled(): boolean {

  return (
    process.env
      .ATLAS_MULTI_ASSET_LIVE_ARMED ===
      "true" &&
    process.env
      .ATLAS_MULTI_ASSET_DRY_RUN ===
      "false"
  );
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
 * Multi-Asset-specific crypto market order builder.
 *
 * IMPORTANT:
 * This intentionally does NOT use the legacy/shared
 * coinbase-order-builder.ts because that module depends on
 * legacy ATLAS_LIVE_ARMED.
 */
function buildAtlasMultiAssetCryptoMarketBuyOrder(
  userId: string,
  instruction: AtlasExecutionInstruction
) {

  return {
    client_order_id:
      `yc_atlas_multi_asset_live_${userId.slice(
        0,
        8
      )}_${Date.now()}`,

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
  };
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
 */
function buildAtlasEquityMarketBuyOrder(
  userId: string,
  instruction: AtlasExecutionInstruction
) {

  return {
    client_order_id:
      `yc_atlas_multi_asset_equity_live_${userId.slice(
        0,
        8
      )}_${Date.now()}`,

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

    /*
     * ========================================================
     * DEFENSE-IN-DEPTH LIVE GATE
     * ========================================================
     *
     * Even if this adapter is called incorrectly from an
     * upstream layer, Coinbase submission remains impossible
     * unless BOTH dedicated Multi-Asset flags allow live mode.
     */

    if (
      !multiAssetLiveEnabled()
    ) {

      return {
        success: false,

        submitted: false,

        response: {
          mode:
            "blocked",

          scope:
            "atlas_multi_asset",

          productId:
            instruction.productId,

          symbol:
            instruction.symbol,

          quoteSizeUsd:
            instruction.quoteSizeUsd,

          reason:
            "atlas_multi_asset_live_not_enabled",
        },
      };
    }


    const isEquity =
      isAtlasEquityInstruction(
        instruction
      );


    /*
     * ========================================================
     * EQUITY PRE-SUBMISSION GATE
     * ========================================================
     *
     * Authenticated GET against the exact Coinbase product.
     *
     * Fail closed before POST /orders unless Coinbase
     * affirmatively proves normal-session tradability.
     */

    if (isEquity) {

      const tradability =
        await evaluateAtlasEquityTradability(
          userId,
          instruction.productId
        );


      if (
        !tradability.allowed
      ) {

        return {
          success: false,

          submitted: false,

          response: {
            mode:
              "live",

            scope:
              "atlas_multi_asset",

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
     * MULTI-ASSET ORDER PAYLOAD
     * ========================================================
     */

    const payload =
      isEquity
        ? buildAtlasEquityMarketBuyOrder(
            userId,
            instruction
          )
        : buildAtlasMultiAssetCryptoMarketBuyOrder(
            userId,
            instruction
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


    if (
      !result.success
    ) {

      return {
        success: false,

        submitted: false,

        response: {
          mode:
            "live",

          scope:
            "atlas_multi_asset",

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

        scope:
          "atlas_multi_asset",

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

  } catch (
    error
  ) {

    return {
      success: false,

      submitted: false,

      response: {
        mode:
          "live",

        scope:
          "atlas_multi_asset",

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
            : String(
                error
              ),
      },
    };
  }
}