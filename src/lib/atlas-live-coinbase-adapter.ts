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



export async function submitAtlasLiveCoinbaseOrder(
  instruction: AtlasExecutionInstruction,
  context: AtlasCoinbaseRequestContext,
  userId: string
): Promise<AtlasLiveCoinbaseAdapterResult> {

  try {
    const payload =
      buildCoinbaseMarketBuyOrder(
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
          productId:
            instruction.productId,
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
        productId:
          instruction.productId,
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