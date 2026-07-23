import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";

export interface CoinbaseOrderExecutorResult {
  success: boolean;
  response: unknown;
}

export async function executeCoinbaseOrder(
  instruction: AtlasExecutionInstruction
): Promise<CoinbaseOrderExecutorResult> {
  return {
    success: true,
    response: {
      mode: "shadow",
      submitted: false,
      broker: instruction.brokerId,
      productId: instruction.productId,
      quoteSizeUsd: instruction.quoteSizeUsd,
      fundingCurrency: instruction.fundingCurrency,
    },
  };
}