/**
 * ============================================================
 * Atlas Execution Adapter
 * ------------------------------------------------------------
 * PURPOSE
 * Convert a PortfolioExecutionPlan into execution instructions.
 *
 * This layer is PURE.
 *
 * It does NOT:
 * - call Coinbase
 * - submit orders
 * - access Supabase
 * - access Atlas execution
 * - access Pulse
 * * It ONLY prepares executable instructions.
 * ============================================================
 */

import type {
  PortfolioExecutionPlan,
  PortfolioExecutionPlanOrder,
} from "./portfolio-execution-planner";

export interface AtlasExecutionInstruction {
  symbol: string;
  brokerId: string;
  productId: string;
  fundingCurrency: "USD" | "USDC";
  quoteSizeUsd: number;
}

export interface AtlasExecutionAdapterResult {
  executable: boolean;
  instructions: AtlasExecutionInstruction[];
  blocked: PortfolioExecutionPlanOrder[];
}

function fundingCurrencyFromProduct(
  productId: string
): "USD" | "USDC" {
  return productId.endsWith("-USDC")
    ? "USDC"
    : "USD";
}

export function buildAtlasExecutionInstructions(
  plan: PortfolioExecutionPlan
): AtlasExecutionAdapterResult {
  const instructions: AtlasExecutionInstruction[] = [];
  const blocked: PortfolioExecutionPlanOrder[] = [];

  for (const order of plan.orders) {
    if (
      !order.executable ||
      !order.productId
    ) {
      blocked.push(order);
      continue;
    }

    instructions.push({
      symbol: order.symbol,
      brokerId: order.brokerId,
      productId: order.productId,
      fundingCurrency: fundingCurrencyFromProduct(
        order.productId
      ),
      quoteSizeUsd: order.proposedBuyUsd,
    });
  }

  return {
    executable: instructions.length > 0,
    instructions,
    blocked,
  };
}