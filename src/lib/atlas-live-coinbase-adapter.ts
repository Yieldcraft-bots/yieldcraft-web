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


  return {
    success:
      result.success,

    submitted:
      result.success,

    response: {
      mode: "live",
      productId:
        instruction.productId,
      quoteSizeUsd:
        instruction.quoteSizeUsd,
      coinbase:
        result.response,
    },
  };
}