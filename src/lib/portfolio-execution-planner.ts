/**
 * Atlas Portfolio Execution Planner
 *
 * Single responsibility:
 * Convert a client-defined allocation plan and a deployable USD amount
 * into a deterministic set of proposed asset purchases.
 *
 * This file knows NOTHING about:
 * - Coinbase API calls
 * - Supabase
 * - JWT
 * - Users
 * - API routes
 * - Environment variables
 * - Order submission
 * - Atlas execution state
 */

import {
  getAtlasAsset,
  type AtlasAsset,
} from "./atlas-assets";
import {
  getAtlasBroker,
  type AtlasBroker,
} from "./atlas-brokers";

export type PortfolioAllocationInput = {
  symbol: string;
  targetPercent: number;
};

export type PortfolioExecutionPlanOrder = {
  symbol: string;
  targetPercent: number;
  proposedBuyUsd: number;

  brokerId: AtlasAsset["broker"];
  productId: string | null;

  executable: boolean;
  reason:
    | "ready"
    | "invalid_target_percent"
    | "asset_not_registered"
    | "asset_accumulation_disabled"
    | "broker_not_registered"
    | "broker_disabled"
    | "broker_does_not_support_crypto"
    | "no_supported_quote_pair"
    | "below_min_order";
};

export type PortfolioExecutionPlan = {
  valid: boolean;
  reason:
    | "plan_ready"
    | "no_allocations"
    | "invalid_deployable_amount"
    | "duplicate_asset"
    | "allocation_total_not_100";

  deployableUsd: number;
  allocationTotalPercent: number;
  plannedUsd: number;
  unplannedUsd: number;

  orders: PortfolioExecutionPlanOrder[];
};

export type BuildPortfolioExecutionPlanInput = {
  allocations: readonly PortfolioAllocationInput[];
  deployableUsd: number;

  fundingCurrency: "USD" | "USDC";
  minOrderUsd?: number;
};

function money(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function resolveProductId(
  asset: AtlasAsset,
  fundingCurrency: "USD" | "USDC"
): string | null {
  if (fundingCurrency === "USDC") {
    return asset.usdcPair ?? null;
  }

  return asset.usdPair ?? null;
}

function createBlockedOrder(
  symbol: string,
  targetPercent: number,
  proposedBuyUsd: number,
  reason: PortfolioExecutionPlanOrder["reason"],
  asset?: AtlasAsset,
  broker?: AtlasBroker
): PortfolioExecutionPlanOrder {
  return {
    symbol,
    targetPercent,
    proposedBuyUsd,
    brokerId: asset?.broker ?? "coinbase",
    productId: null,
    executable: false,
    reason:
      broker && !broker.enabled
        ? "broker_disabled"
        : reason,
  };
}

export function buildPortfolioExecutionPlan(
  input: BuildPortfolioExecutionPlanInput
): PortfolioExecutionPlan {
  const deployableUsd = money(input.deployableUsd);
  const minOrderUsd = money(input.minOrderUsd ?? 1);

  if (!Number.isFinite(deployableUsd) || deployableUsd <= 0) {
    return {
      valid: false,
      reason: "invalid_deployable_amount",
      deployableUsd,
      allocationTotalPercent: 0,
      plannedUsd: 0,
      unplannedUsd: Math.max(deployableUsd, 0),
      orders: [],
    };
  }

  if (input.allocations.length === 0) {
    return {
      valid: false,
      reason: "no_allocations",
      deployableUsd,
      allocationTotalPercent: 0,
      plannedUsd: 0,
      unplannedUsd: deployableUsd,
      orders: [],
    };
  }

  const normalizedAllocations = input.allocations.map((allocation) => ({
    symbol: normalizeSymbol(allocation.symbol),
    targetPercent: Number(allocation.targetPercent),
  }));

  const symbols = normalizedAllocations.map(
    (allocation) => allocation.symbol
  );

  if (new Set(symbols).size !== symbols.length) {
    return {
      valid: false,
      reason: "duplicate_asset",
      deployableUsd,
      allocationTotalPercent: money(
        normalizedAllocations.reduce(
          (total, allocation) => total + allocation.targetPercent,
          0
        )
      ),
      plannedUsd: 0,
      unplannedUsd: deployableUsd,
      orders: [],
    };
  }

  const allocationTotalPercent = money(
    normalizedAllocations.reduce(
      (total, allocation) => total + allocation.targetPercent,
      0
    )
  );

  if (allocationTotalPercent !== 100) {
    return {
      valid: false,
      reason: "allocation_total_not_100",
      deployableUsd,
      allocationTotalPercent,
      plannedUsd: 0,
      unplannedUsd: deployableUsd,
      orders: [],
    };
  }

  const orders = normalizedAllocations.map(
    (allocation): PortfolioExecutionPlanOrder => {
      const proposedBuyUsd = money(
        deployableUsd * (allocation.targetPercent / 100)
      );

      if (
        !Number.isFinite(allocation.targetPercent) ||
        allocation.targetPercent <= 0 ||
        allocation.targetPercent > 100
      ) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "invalid_target_percent"
        );
      }

      const asset = getAtlasAsset(allocation.symbol);

      if (!asset) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "asset_not_registered"
        );
      }

      if (!asset.accumulationEnabled) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "asset_accumulation_disabled",
          asset
        );
      }

      const broker = getAtlasBroker(asset.broker);

      if (!broker) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "broker_not_registered",
          asset
        );
      }

      if (!broker.enabled) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "broker_disabled",
          asset,
          broker
        );
      }

      if (!broker.supportsCrypto) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "broker_does_not_support_crypto",
          asset,
          broker
        );
      }

      const productId = resolveProductId(
        asset,
        input.fundingCurrency
      );

      if (!productId) {
        return createBlockedOrder(
          allocation.symbol,
          allocation.targetPercent,
          proposedBuyUsd,
          "no_supported_quote_pair",
          asset,
          broker
        );
      }

      if (proposedBuyUsd < minOrderUsd) {
        return {
          symbol: allocation.symbol,
          targetPercent: allocation.targetPercent,
          proposedBuyUsd,
          brokerId: asset.broker,
          productId,
          executable: false,
          reason: "below_min_order",
        };
      }

      return {
        symbol: allocation.symbol,
        targetPercent: allocation.targetPercent,
        proposedBuyUsd,
        brokerId: asset.broker,
        productId,
        executable: true,
        reason: "ready",
      };
    }
  );

  const plannedUsd = money(
    orders
      .filter((order) => order.executable)
      .reduce(
        (total, order) => total + order.proposedBuyUsd,
        0
      )
  );

  return {
    valid: true,
    reason: "plan_ready",
    deployableUsd,
    allocationTotalPercent,
    plannedUsd,
    unplannedUsd: money(deployableUsd - plannedUsd),
    orders,
  };
}