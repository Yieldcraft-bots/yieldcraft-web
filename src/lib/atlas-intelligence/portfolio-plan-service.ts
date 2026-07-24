/**
 * Client Portfolio Plan Service
 *
 * Single responsibility:
 * Load a client's saved allocation, calculate deployable capital,
 * and build a validated portfolio execution plan.
 *
 * This file knows NOTHING about:
 * - Coinbase API calls
 * - Order submission
 * - JWT
 * - API routes
 * - Atlas execution state
 * - Market regime
 */

import {
  calculateAtlasAllocation,
  type AtlasAllocationInput,
  type AtlasAllocationResult,
} from "../atlas-allocation-policy";
import {
  buildPortfolioExecutionPlan,
  type PortfolioExecutionPlan,
} from "../portfolio-execution-planner";
import {
  getClientAllocationPlan,
  type ClientAllocationRow,
} from "../repositories/clientAllocationRepository";

export type BuildClientPortfolioPlanInput = {
  userId: string;
  allocationPolicy: AtlasAllocationInput;
  fundingCurrency: "USD" | "USDC";
};

export type ClientPortfolioPlanResult = {
  userId: string;
  portfolioPlanId: string | null;
  allocationRows: ClientAllocationRow[];
  allocationResult: AtlasAllocationResult;
  portfolioPlan: PortfolioExecutionPlan | null;
};

export async function buildClientPortfolioPlan(
  input: BuildClientPortfolioPlanInput
): Promise<ClientPortfolioPlanResult> {
  const allocationRows = await getClientAllocationPlan(input.userId);

  const allocationResult = calculateAtlasAllocation(
    input.allocationPolicy
  );

  if (!allocationResult.eligible) {
    return {
      userId: input.userId,
      portfolioPlanId: null,
      allocationRows,
      allocationResult,
      portfolioPlan: null,
    };
  }

  const portfolioPlan = buildPortfolioExecutionPlan({
    allocations: allocationRows.map((row) => ({
      symbol: row.asset_symbol,
      targetPercent: row.target_percent,
    })),
    deployableUsd: allocationResult.proposedBuyUsd,
    fundingCurrency: input.fundingCurrency,
    minOrderUsd: input.allocationPolicy.minBuy,
  });

  return {
    userId: input.userId,
    portfolioPlanId: portfolioPlan.valid
      ? crypto.randomUUID()
      : null,
    allocationRows,
    allocationResult,
    portfolioPlan,
  };
}