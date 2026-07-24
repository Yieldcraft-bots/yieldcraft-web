import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";
import {
  buildCoinbaseMarketBuyOrder,
} from "./coinbase-order-builder";
import {
  cbPost,
} from "./coinbase-client";

export interface CoinbaseOrderExecutorResult {
  success: boolean;
  response: unknown;
}

export async function executeCoinbaseOrder(
  instruction: AtlasExecutionInstruction
): Promise<CoinbaseOrderExecutorResult> {
  try {
    const payload =
      buildCoinbaseMarketBuyOrder(
        "shadow",
        instruction.productId,
        instruction.quoteSizeUsd,
        false
      );

    const response = await cbPost(
      "/api/v3/brokerage/orders",
      payload
    );

    const data = await response.json();

    return {
      success: false,
      response: {
        mode: "shadow",
        submitted: false,
        reason: "shadow_only",
        productId: instruction.productId,
        quoteSizeUsd: instruction.quoteSizeUsd,
        fundingCurrency: instruction.fundingCurrency,
        payload,
        coinbaseResponse: data,
      },
    };
  } catch (error) {
    return {
      success: false,
      response: {
        mode: "shadow",
        submitted: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }
}