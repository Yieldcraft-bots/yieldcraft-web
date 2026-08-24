/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Persistent Accumulation State Service
 * ------------------------------------------------------------
 * PURPOSE
 * Combine:
 *
 * - current authoritative client cash
 * - saved client allocation
 * - prior Multi-Asset cash baseline
 * - prior per-asset pending balances
 *
 * through the pure accumulation engine, then persist the
 * resulting Multi-Asset-only state.
 *
 * SAFETY
 * - Multi-Asset only
 * - Per-client user_id isolation
 * - No Coinbase calls
 * - No order submission
 * - No approval mutation
 * - No authorization mutation
 * - Does not access atlas_user_state
 * - Does not modify legacy Atlas BTC
 * - No Pulse
 * - No Recon
 *
 * IMPORTANT
 * Persistence occurs only after a valid accumulation result.
 * ============================================================
 */

import {
  calculateAtlasMultiAssetAccumulation,
  type AtlasMultiAssetAccumulationResult,
} from "./atlas-multi-asset-accumulation";

import {
  SupabaseAtlasMultiAssetStateRepository,
} from "./repositories/atlasMultiAssetStateRepository";

import type {
  ClientAllocationRow,
} from "./repositories/clientAllocationRepository";


export type ProcessAtlasMultiAssetAccumulationInput = {
  userId: string;

  currentCashUsd: number;

  deployPct: number;

  minOrderUsd: number;

  allocationRows:
    readonly ClientAllocationRow[];
};


export type ProcessAtlasMultiAssetAccumulationResult = {
  userId: string;

  accumulation:
    AtlasMultiAssetAccumulationResult;

  previousState: {
    accountedCashUsd: number;

    pendingCount: number;
  };

  persisted: boolean;
};


function normalizeUserId(
  userId: string
): string {

  return userId.trim();
}


function normalizeSymbol(
  symbol: string
): string {

  return symbol
    .trim()
    .toUpperCase();
}


export async function processAtlasMultiAssetAccumulation(
  input: ProcessAtlasMultiAssetAccumulationInput
): Promise<ProcessAtlasMultiAssetAccumulationResult> {

  const userId =
    normalizeUserId(
      input.userId
    );


  if (!userId) {
    throw new Error(
      "atlas_multi_asset_user_id_missing"
    );
  }


  if (
    !Number.isFinite(
      input.currentCashUsd
    ) ||
    input.currentCashUsd < 0
  ) {
    throw new Error(
      "atlas_multi_asset_current_cash_invalid"
    );
  }


  if (
    !Number.isFinite(
      input.deployPct
    ) ||
    input.deployPct <= 0 ||
    input.deployPct > 100
  ) {
    throw new Error(
      "atlas_multi_asset_deploy_percent_invalid"
    );
  }


  if (
    !Number.isFinite(
      input.minOrderUsd
    ) ||
    input.minOrderUsd <= 0
  ) {
    throw new Error(
      "atlas_multi_asset_min_order_invalid"
    );
  }


  const repository =
    new SupabaseAtlasMultiAssetStateRepository();


  const [
    cashState,
    pendingAllocations,
  ] =
    await Promise.all([
      repository.loadCashState(
        userId
      ),

      repository.loadPendingAllocations(
        userId
      ),
    ]);


  const accountedCashUsd =
    cashState?.accountedCashUsd ??
    0;


  const accumulation =
    calculateAtlasMultiAssetAccumulation({
      currentCashUsd:
        input.currentCashUsd,

      accountedCashUsd,

      deployPct:
        input.deployPct,

      minOrderUsd:
        input.minOrderUsd,

      allocations:
        input.allocationRows.map(
          (row) => ({
            symbol:
              normalizeSymbol(
                row.asset_symbol
              ),

            targetPercent:
              Number(
                row.target_percent
              ),
          })
        ),

      existingPending:
        pendingAllocations.map(
          (row) => ({
            symbol:
              normalizeSymbol(
                row.assetSymbol
              ),

            pendingUsd:
              row.pendingUsd,
          })
        ),
    });


  if (!accumulation.valid) {
    return {
      userId,

      accumulation,

      previousState: {
        accountedCashUsd,

        pendingCount:
          pendingAllocations.length,
      },

      persisted:
        false,
    };
  }


  /*
   * Persist every resulting bucket.
   *
   * setPendingAllocation() deletes zero-value rows,
   * so stale empty buckets do not remain in the table.
   */
  for (
    const bucket
    of accumulation.buckets
  ) {

    await repository.setPendingAllocation({
      userId,

      assetSymbol:
        bucket.symbol,

      pendingUsd:
        bucket.pendingUsd,
    });
  }


  const now =
    new Date()
      .toISOString();


  /*
   * Save the current cash observation as the new baseline.
   *
   * This is what prevents the next cron cycle from treating
   * unchanged Coinbase cash as fresh deployable money.
   */
  await repository.saveCashState({
    userId,

    lastObservedCashUsd:
      accumulation.currentCashUsd,

    accountedCashUsd:
      accumulation.resultingAccountedCashUsd,

    lastProcessedCashUsd:
      accumulation.newUnprocessedCashUsd,

    lastProcessedAt:
      now,
  });


  return {
    userId,

    accumulation,

    previousState: {
      accountedCashUsd,

      pendingCount:
        pendingAllocations.length,
    },

    persisted:
      true,
  };
}