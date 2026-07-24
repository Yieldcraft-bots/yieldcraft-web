import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";
import {
  buildCoinbaseMarketBuyOrder,
} from "./coinbase-order-builder";
import {
  cbPost,
} from "./coinbase-client";
import {
  createAtlasShadowExecutionLog,
} from "./atlas-shadow-execution-log";

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

    const log =
      createAtlasShadowExecutionLog({
        mode: "SHADOW",
        symbol: instruction.symbol,
        productId: instruction.productId,
        quoteSizeUsd: instruction.quoteSizeUsd,
        success: false,
        responseSummary: "shadow_only_no_order_submitted",
      });

    return {
      success: false,
      response: {
        log,
        mode: "shadow",
        submitted: false,
        reason: "shadow_only",
        payload,
        coinbaseResponse: data,
      },
    };
  } catch (error) {
    const log =
      createAtlasShadowExecutionLog({
        mode: "SHADOW",
        symbol: instruction.symbol,
        productId: instruction.productId,
        quoteSizeUsd: instruction.quoteSizeUsd,
        success: false,
        responseSummary: "shadow_execution_error",
      });

    return {
      success: false,
      response: {
        log,
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