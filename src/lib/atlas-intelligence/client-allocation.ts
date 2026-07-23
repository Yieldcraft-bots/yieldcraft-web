/**
 * ============================================================
 * Atlas Intelligence
 * Client Allocation Contract
 * ------------------------------------------------------------
 * PURPOSE
 * Validate the accumulation plan explicitly selected by the
 * client.
 *
 * The percentages describe how Atlas should distribute the
 * portion of cash already approved for deployment by the
 * existing Atlas allocation policy.
 *
 * They do NOT represent:
 * - The client's entire Coinbase account
 * - A required account-level cash reserve
 * - Investment advice from Atlas
 * - An Atlas-generated portfolio
 *
 * SAFETY
 * - Read-only
 * - Pure validation only
 * - No trading
 * - No order creation
 * - No automatic selling
 * - No investment recommendations
 * - No Coinbase imports
 * - No Supabase imports
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 *
 * PERMANENT DOCTRINE
 * The client decides what to own.
 * Atlas only automates accumulation according to that
 * client-selected plan.
 * ============================================================
 */

import { isAtlasAssetAllocatable } from "./asset-catalog";
import type { AtlasAssetDefinition } from "./types";

export type ClientAllocationItem = {
  symbol: string;
  targetPercent: number;
};

export type ClientAllocationPlan = {
  allocations: readonly ClientAllocationItem[];
};

export type ValidatedClientAllocationItem = {
  symbol: string;
  targetPercent: number;
};

export type ClientAllocationValidationErrorCode =
  | "NO_ASSETS_SELECTED"
  | "INVALID_SYMBOL"
  | "DUPLICATE_SYMBOL"
  | "ASSET_NOT_REGISTERED"
  | "ASSET_NOT_ALLOCATABLE"
  | "INVALID_TARGET_PERCENT"
  | "ALLOCATION_TOTAL_INVALID";

export type ClientAllocationValidationError = {
  code: ClientAllocationValidationErrorCode;
  symbol?: string;
  message: string;
};

export type ClientAllocationValidationResult =
  | {
      valid: true;
      allocations: readonly ValidatedClientAllocationItem[];
      totalPercent: 100;
      errors: readonly [];
    }
  | {
      valid: false;
      allocations: readonly [];
      totalPercent: number;
      errors: readonly ClientAllocationValidationError[];
    };

const REQUIRED_TOTAL_PERCENT = 100;
const TOTAL_TOLERANCE = 0.01;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function totalsEqualOneHundred(totalPercent: number): boolean {
  return (
    Math.abs(totalPercent - REQUIRED_TOTAL_PERCENT) <= TOTAL_TOLERANCE
  );
}

export function validateClientAllocationPlan(
  plan: ClientAllocationPlan,
  assetRegistry: readonly AtlasAssetDefinition[]
): ClientAllocationValidationResult {
  const errors: ClientAllocationValidationError[] = [];

  if (!plan.allocations.length) {
    return {
      valid: false,
      allocations: [],
      totalPercent: 0,
      errors: [
        {
          code: "NO_ASSETS_SELECTED",
          message:
            "Select at least one allocatable asset for Atlas accumulation.",
        },
      ],
    };
  }

  const registryBySymbol = new Map(
    assetRegistry.map((asset) => [
      normalizeSymbol(asset.symbol),
      asset,
    ])
  );

  const seenSymbols = new Set<string>();

  const normalizedAllocations = plan.allocations.map((allocation) => {
    const symbol = normalizeSymbol(allocation.symbol);
    const targetPercent = roundPercent(allocation.targetPercent);

    if (!symbol) {
      errors.push({
        code: "INVALID_SYMBOL",
        message: "Every allocation must include a valid symbol.",
      });

      return {
        symbol,
        targetPercent,
      };
    }

    if (seenSymbols.has(symbol)) {
      errors.push({
        code: "DUPLICATE_SYMBOL",
        symbol,
        message: `${symbol} appears more than once in the allocation plan.`,
      });
    } else {
      seenSymbols.add(symbol);
    }

    const registeredAsset = registryBySymbol.get(symbol);

    if (!registeredAsset) {
      errors.push({
        code: "ASSET_NOT_REGISTERED",
        symbol,
        message: `${symbol} is not registered in Atlas Intelligence.`,
      });
    } else if (!isAtlasAssetAllocatable(registeredAsset)) {
      errors.push({
        code: "ASSET_NOT_ALLOCATABLE",
        symbol,
        message: `${symbol} is registered in Atlas but is not available for portfolio configuration.`,
      });
    }

    if (
      !Number.isFinite(targetPercent) ||
      targetPercent <= 0 ||
      targetPercent > REQUIRED_TOTAL_PERCENT
    ) {
      errors.push({
        code: "INVALID_TARGET_PERCENT",
        symbol,
        message: `${symbol} must have a target percentage greater than 0 and no more than 100.`,
      });
    }

    return {
      symbol,
      targetPercent,
    };
  });

  const totalPercent = roundPercent(
    normalizedAllocations.reduce(
      (total, allocation) =>
        total + allocation.targetPercent,
      0
    )
  );

  if (!totalsEqualOneHundred(totalPercent)) {
    errors.push({
      code: "ALLOCATION_TOTAL_INVALID",
      message:
        `Client-selected asset percentages must total 100% of the Atlas deployable amount. Current total: ${totalPercent}%.`,
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      allocations: [],
      totalPercent,
      errors,
    };
  }

  return {
    valid: true,
    allocations: normalizedAllocations,
    totalPercent: 100,
    errors: [],
  };
}