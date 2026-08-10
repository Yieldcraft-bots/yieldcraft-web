/**
 * Client Portfolio Plan Service
 *
 * Single responsibility:
 * Load a client's saved allocation, calculate deployable capital,
 * build a validated portfolio execution plan, and persist the
 * generated portfolio plan.
 *
 * This file knows NOTHING about:
 *
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

import {
  saveAtlasPortfolioPlan,
} from "../repositories/atlasPortfolioPlanRepository";

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
  const allocationRows =
    await getClientAllocationPlan(input.userId);

  const allocationResult =
    calculateAtlasAllocation(
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

  const portfolioPlan =
    buildPortfolioExecutionPlan({
      allocations: allocationRows.map((row) => ({
        symbol: row.asset_symbol,
        targetPercent: row.target_percent,
      })),
      deployableUsd:
        allocationResult.proposedBuyUsd,
      fundingCurrency:
        input.fundingCurrency,
      minOrderUsd:
        input.allocationPolicy.minBuy,
    });

  const portfolioPlanId =
    portfolioPlan.valid
      ? crypto.randomUUID()
      : null;

  if (portfolioPlanId) {
    await saveAtlasPortfolioPlan({
      portfolioPlanId,
      userId: input.userId,
      plan: portfolioPlan,
    });
  }

  return {
    userId: input.userId,
    portfolioPlanId,
    allocationRows,
    allocationResult,
    portfolioPlan,
  };
}