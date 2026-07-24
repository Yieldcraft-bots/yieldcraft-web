import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";
import {
  buildCoinbaseMarketBuyOrder,
} from "./coinbase-order-builder";
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

    const log =
      createAtlasShadowExecutionLog({
        mode: "SHADOW",
        symbol: instruction.symbol,
        productId: instruction.productId,
        quoteSizeUsd: instruction.quoteSizeUsd,
        success: true,
        responseSummary: "shadow_order_created_no_submission",
      });

    return {
      success: true,
      response: {
        log,
        mode: "shadow",
        submitted: false,
        reason: "shadow_only",
        payload,
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