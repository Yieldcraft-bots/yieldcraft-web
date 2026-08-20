/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Adapter
 *
 * PURPOSE
 * Controlled Coinbase communication boundary for Atlas live execution.
 *
 * SAFETY
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 * - No order decisions
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


export interface AtlasLiveCoinbaseAdapterResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


function money(n: number): string {
  return Number(
    n.toFixed(2)
  ).toFixed(2);
}


/**
 * Coinbase crypto products currently use readable IDs
 * such as BTC-USD / ETH-USD.
 *
 * Coinbase equity products use canonical hashed IDs
 * returned by the Products API.
 *
 * This keeps equity handling isolated to Atlas Multi-Asset
 * without changing the shared Coinbase crypto order builder.
 */
function isAtlasEquityInstruction(
  instruction: AtlasExecutionInstruction
): boolean {
  return !instruction.productId.includes("-");
}


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

    side: "BUY" as const,

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
        "NORMAL",

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
          mode: "live",

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
        mode: "live",

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
        mode: "live",

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