/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Persistent Accumulation State Service
 * ------------------------------------------------------------
 * PURPOSE
 * Combine:
 *
 * - current authoritative client cash
 * - latest saved client allocation
 * - prior Multi-Asset cash baseline
 * - prior per-asset pending balances
 *
 * through the pure accumulation engine, then persist the
 * resulting Multi-Asset-only state.
 *
 * CORE MULTI-ASSET RULES
 * - 100% of genuinely new Atlas cash enters portfolio state
 * - Latest client allocation is authoritative
 * - Unexecuted pending capital follows allocation changes
 * - Previously purchased holdings are NEVER sold here
 * - Same observed cash cannot be allocated repeatedly
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
  type AtlasMultiAssetPendingInput,
} from "./atlas-multi-asset-accumulation";

import {
  SupabaseAtlasMultiAssetStateRepository,
  type AtlasMultiAssetPendingAllocation,
} from "./repositories/atlasMultiAssetStateRepository";

import type {
  ClientAllocationRow,
} from "./repositories/clientAllocationRepository";


export type ProcessAtlasMultiAssetAccumulationInput = {
  userId: string;

  currentCashUsd: number;

  /**
   * Temporary compatibility input.
   *
   * Multi-Asset accumulation now commits 100% of genuinely
   * new cash regardless of this value.
   */
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

    pendingUsd: number;
  };

  allocationChange: {
    detected: boolean;

    latestAllocationUpdatedAt:
      | string
      | null;

    previousProcessedAt:
      | string
      | null;

    pendingRedistributedUsd: number;

    stalePendingSymbols:
      string[];
  };

  persisted: boolean;
};


function money(
  value: number
): number {
  return Number(
    value.toFixed(8)
  );
}


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


function validTimestamp(
  value:
    | string
    | null
    | undefined
): number | null {
  if (!value) {
    return null;
  }

  const timestamp =
    new Date(
      value
    ).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}


function latestAllocationUpdatedAt(
  allocationRows:
    readonly ClientAllocationRow[]
): string | null {
  let latest:
    string | null =
      null;

  let latestTimestamp =
    -1;

  for (
    const row
    of allocationRows
  ) {
    const candidate =
      validTimestamp(
        row.updated_at
      ) ??
      validTimestamp(
        row.created_at
      );

    if (
      candidate !== null &&
      candidate >
        latestTimestamp
    ) {
      latestTimestamp =
        candidate;

      latest =
        row.updated_at ??
        row.created_at;
    }
  }

  return latest;
}


function sumPendingUsd(
  rows:
    readonly AtlasMultiAssetPendingAllocation[]
): number {
  return money(
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        (
          Number.isFinite(
            row.pendingUsd
          )
            ? row.pendingUsd
            : 0
        ),
      0
    )
  );
}


/**
 * Redistribute existing UNEXECUTED pending capital across the
 * client's latest allocation.
 *
 * This does NOT touch any purchased holdings.
 *
 * Rounding residue is assigned to the final asset so the total
 * redistributed pending amount remains exact.
 */
function redistributePendingToLatestAllocation(
  totalPendingUsd: number,
  allocationRows:
    readonly ClientAllocationRow[]
): AtlasMultiAssetPendingInput[] {
  if (
    totalPendingUsd <= 0 ||
    allocationRows.length ===
      0
  ) {
    return [];
  }

  const normalized =
    allocationRows.map(
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
    );

  let distributedUsd =
    0;

  return normalized.map(
    (
      allocation,
      index
    ) => {
      const isLast =
        index ===
        normalized.length -
          1;

      const pendingUsd =
        isLast
          ? money(
              Math.max(
                totalPendingUsd -
                  distributedUsd,
                0
              )
            )
          : money(
              totalPendingUsd *
                (
                  allocation.targetPercent /
                  100
                )
            );

      distributedUsd =
        money(
          distributedUsd +
            pendingUsd
        );

      return {
        symbol:
          allocation.symbol,

        pendingUsd,
      };
    }
  );
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
    input.currentCashUsd <
      0
  ) {
    throw new Error(
      "atlas_multi_asset_current_cash_invalid"
    );
  }

  /*
   * Compatibility validation.
   *
   * deployPct remains in the launch-time interface but no
   * longer reduces Multi-Asset portfolio accounting.
   */
  if (
    !Number.isFinite(
      input.deployPct
    ) ||
    input.deployPct <=
      0 ||
    input.deployPct >
      100
  ) {
    throw new Error(
      "atlas_multi_asset_deploy_percent_invalid"
    );
  }

  if (
    !Number.isFinite(
      input.minOrderUsd
    ) ||
    input.minOrderUsd <=
      0
  ) {
    throw new Error(
      "atlas_multi_asset_min_order_invalid"
    );
  }

  if (
    input.allocationRows.length ===
      0
  ) {
    throw new Error(
      "atlas_multi_asset_allocation_missing"
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

  const previousPendingUsd =
    sumPendingUsd(
      pendingAllocations
    );

  /*
   * ==========================================================
   * LATEST-ALLOCATION DETECTION
   * ==========================================================
   *
   * replace_client_allocation_plan() deletes/reinserts the
   * client's allocation atomically.
   *
   * Therefore a newer allocation row timestamp than the last
   * successful Multi-Asset processing timestamp means the
   * client's mandate changed since our prior cycle.
   */

  const latestAllocationAt =
    latestAllocationUpdatedAt(
      input.allocationRows
    );

  const latestAllocationTimestamp =
    validTimestamp(
      latestAllocationAt
    );

  const previousProcessedAt =
    cashState
      ?.lastProcessedAt ??
    null;

  const previousProcessedTimestamp =
    validTimestamp(
      previousProcessedAt
    );

  const allocationChanged =
    pendingAllocations.length >
      0 &&
    latestAllocationTimestamp !==
      null &&
    previousProcessedTimestamp !==
      null &&
    latestAllocationTimestamp >
      previousProcessedTimestamp;

  const currentAllocationSymbols =
    new Set(
      input.allocationRows.map(
        (row) =>
          normalizeSymbol(
            row.asset_symbol
          )
      )
    );

  const stalePendingSymbols =
    pendingAllocations
      .map(
        (row) =>
          normalizeSymbol(
            row.assetSymbol
          )
      )
      .filter(
        (symbol) =>
          !currentAllocationSymbols.has(
            symbol
          )
      );

  /*
   * When allocation changed, ONLY UNEXECUTED pending dollars
   * are redistributed.
   *
   * Purchased holdings are not part of this repository and
   * cannot be sold or changed here.
   */
  const pendingForCalculation:
    AtlasMultiAssetPendingInput[] =
      allocationChanged
        ? redistributePendingToLatestAllocation(
            previousPendingUsd,
            input.allocationRows
          )
        : pendingAllocations.map(
            (row) => ({
              symbol:
                normalizeSymbol(
                  row.assetSymbol
                ),

              pendingUsd:
                row.pendingUsd,
            })
          );

  /*
   * ==========================================================
   * 100% CAPITAL ACCUMULATION
   * ==========================================================
   */

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
        pendingForCalculation,
    });

  if (
    !accumulation.valid
  ) {
    return {
      userId,

      accumulation,

      previousState: {
        accountedCashUsd,

        pendingCount:
          pendingAllocations.length,

        pendingUsd:
          previousPendingUsd,
      },

      allocationChange: {
        detected:
          allocationChanged,

        latestAllocationUpdatedAt:
          latestAllocationAt,

        previousProcessedAt,

        pendingRedistributedUsd:
          allocationChanged
            ? previousPendingUsd
            : 0,

        stalePendingSymbols,
      },

      persisted:
        false,
    };
  }

  /*
   * ==========================================================
   * PERSIST CURRENT ALLOCATION BUCKETS
   * ==========================================================
   *
   * Every resulting bucket is written.
   *
   * setPendingAllocation() deletes zero-value rows.
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

  /*
   * ==========================================================
   * DELETE STALE PENDING SYMBOLS
   * ==========================================================
   *
   * If an allocation changed and an asset was removed entirely,
   * its old unexecuted pending row must not remain available to
   * future plans.
   *
   * Its dollars have already been included in previousPendingUsd
   * and redistributed across the new allocation above.
   */
  if (
    allocationChanged
  ) {
    for (
      const staleSymbol
      of stalePendingSymbols
    ) {
      await repository.setPendingAllocation({
        userId,

        assetSymbol:
          staleSymbol,

        pendingUsd:
          0,
      });
    }
  }

  const now =
    new Date()
      .toISOString();

  /*
   * Save the current authoritative cash observation as the new
   * baseline.
   *
   * Because 100% of genuinely new cash is now committed into
   * pending portfolio state, advancing this baseline cannot
   * strand a legacy deployPct remainder.
   *
   * This prevents the next cron cycle from treating unchanged
   * Coinbase cash as a fresh contribution.
   */
  await repository.saveCashState({
    userId,

    lastObservedCashUsd:
      accumulation.currentCashUsd,

    accountedCashUsd:
      accumulation
        .resultingAccountedCashUsd,

    lastProcessedCashUsd:
      accumulation
        .newUnprocessedCashUsd,

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

      pendingUsd:
        previousPendingUsd,
    },

    allocationChange: {
      detected:
        allocationChanged,

      latestAllocationUpdatedAt:
        latestAllocationAt,

      previousProcessedAt,

      pendingRedistributedUsd:
        allocationChanged
          ? previousPendingUsd
          : 0,

      stalePendingSymbols,
    },

    persisted:
      true,
  };
}