import type { AtlasExecutionInstruction } from "./atlas-execution-adapter";
import {
  executeCoinbaseOrder,
  type CoinbaseOrderExecutorResult,
} from "./coinbase-order-executor";

export type AtlasExecutionRouterResult =
  CoinbaseOrderExecutorResult & {
    brokerId: string;
  };

export async function routeAtlasExecution(
  instruction: AtlasExecutionInstruction
): Promise<AtlasExecutionRouterResult> {
  if (instruction.brokerId === "coinbase") {
    return {
      brokerId: instruction.brokerId,
      ...(await executeCoinbaseOrder(instruction)),
    };
  }

  return {
    brokerId: instruction.brokerId,
    success: false,
    response: {
      mode: "shadow",
      submitted: false,
      reason: "unsupported_broker",
    },
  };
}