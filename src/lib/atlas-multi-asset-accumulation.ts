/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Pending Allocation Accumulation Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Convert 100% of genuinely new/unprocessed Atlas cash into
 * deterministic per-asset pending allocation balances using
 * the client's saved target allocation.
 *
 * CORE MULTI-ASSET RULE
 * Every genuinely new Atlas dollar is committed to the client's
 * portfolio allocation.
 *
 * Intelligence and execution timing are separate concerns.
 * This engine accounts capital; it does not decide when to trade.
 *
 * SAFETY
 * - Pure calculation only
 * - Multi-Asset only
 * - No Supabase
 * - No Coinbase
 * - No execution
 * - No order submission
 * - No approval mutation
 * - No authorization mutation
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 *
 * IMPORTANT
 * This engine does NOT decide whether cash came from a deposit,
 * sale, refund, transfer, or other source.
 *
 * It only prevents the SAME observed cash from being allocated
 * repeatedly across automation cycles.
 *
 * Sell/deposit-source safeguards remain a separate launch gate.
 *
 * BACKWARD COMPATIBILITY
 * deployPct remains in the input contract temporarily so existing
 * Multi-Asset callers do not break during launch migration.
 *
 * It no longer reduces portfolio accounting. 100% of genuinely
 * new cash is committed to the client's allocation.
 * ============================================================
 */

export type AtlasMultiAssetAllocationTarget = {
  symbol: string;
  targetPercent: number;
};

export type AtlasMultiAssetPendingInput = {
  symbol: string;
  pendingUsd: number;
};

export type AtlasMultiAssetAccumulationBucket = {
  symbol: string;

  targetPercent: number;

  previousPendingUsd: number;

  addedPendingUsd: number;

  pendingUsd: number;

  executableUsd: number;

  executable: boolean;
};

export type AtlasMultiAssetAccumulationInput = {
  currentCashUsd: number;

  accountedCashUsd: number;

  /**
   * Temporary compatibility field.
   *
   * Multi-Asset portfolio accounting now commits 100% of
   * genuinely new cash regardless of this value.
   *
   * Intelligent deployment timing belongs downstream.
   */
  deployPct: number;

  minOrderUsd: number;

  allocations:
    readonly AtlasMultiAssetAllocationTarget[];

  existingPending:
    readonly AtlasMultiAssetPendingInput[];
};

export type AtlasMultiAssetAccumulationResult = {
  valid: boolean;

  reason:
    | "accumulation_ready"
    | "invalid_cash"
    | "invalid_accounted_cash"
    | "invalid_deploy_percent"
    | "invalid_min_order"
    | "no_allocations"
    | "duplicate_asset"
    | "allocation_total_not_100";

  currentCashUsd: number;

  previousAccountedCashUsd: number;

  rebasedAccountedCashUsd: number;

  newUnprocessedCashUsd: number;

  /**
   * Compatibility field name.
   *
   * This now represents 100% of newly committed portfolio
   * capital, not a percentage-reduced deployment amount.
   */
  newlyDeployableUsd: number;

  resultingAccountedCashUsd: number;

  allocationTotalPercent: number;

  buckets:
    AtlasMultiAssetAccumulationBucket[];
};

function money(
  value: number
): number {
  return Number(
    value.toFixed(8)
  );
}

function normalizeSymbol(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

export function calculateAtlasMultiAssetAccumulation(
  input: AtlasMultiAssetAccumulationInput
): AtlasMultiAssetAccumulationResult {
  const currentCashUsd =
    money(
      input.currentCashUsd
    );

  const accountedCashUsd =
    money(
      input.accountedCashUsd
    );

  /*
   * deployPct is retained temporarily for caller compatibility.
   *
   * We still validate it while the old contract exists, but it
   * does NOT reduce Multi-Asset portfolio accounting.
   */
  const deployPct =
    Number(
      input.deployPct
    );

  const minOrderUsd =
    money(
      input.minOrderUsd
    );

  if (
    !Number.isFinite(
      currentCashUsd
    ) ||
    currentCashUsd < 0
  ) {
    return {
      valid: false,
      reason:
        "invalid_cash",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  if (
    !Number.isFinite(
      accountedCashUsd
    ) ||
    accountedCashUsd < 0
  ) {
    return {
      valid: false,
      reason:
        "invalid_accounted_cash",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  /*
   * Temporary compatibility validation.
   *
   * Once all Multi-Asset callers have migrated away from the
   * legacy deployPct contract, this field can be removed in a
   * separate isolated cleanup.
   */
  if (
    !Number.isFinite(
      deployPct
    ) ||
    deployPct <= 0 ||
    deployPct > 100
  ) {
    return {
      valid: false,
      reason:
        "invalid_deploy_percent",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  if (
    !Number.isFinite(
      minOrderUsd
    ) ||
    minOrderUsd <= 0
  ) {
    return {
      valid: false,
      reason:
        "invalid_min_order",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  if (
    input.allocations.length === 0
  ) {
    return {
      valid: false,
      reason:
        "no_allocations",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  const allocations =
    input.allocations.map(
      (allocation) => ({
        symbol:
          normalizeSymbol(
            allocation.symbol
          ),

        targetPercent:
          Number(
            allocation.targetPercent
          ),
      })
    );

  const symbols =
    allocations.map(
      (allocation) =>
        allocation.symbol
    );

  if (
    new Set(
      symbols
    ).size !==
    symbols.length
  ) {
    return {
      valid: false,
      reason:
        "duplicate_asset",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent: 0,
      buckets: [],
    };
  }

  const allocationTotalPercent =
    money(
      allocations.reduce(
        (
          total,
          allocation
        ) =>
          total +
          allocation.targetPercent,
        0
      )
    );

  if (
    allocationTotalPercent !==
    100
  ) {
    return {
      valid: false,
      reason:
        "allocation_total_not_100",
      currentCashUsd,
      previousAccountedCashUsd:
        accountedCashUsd,
      rebasedAccountedCashUsd: 0,
      newUnprocessedCashUsd: 0,
      newlyDeployableUsd: 0,
      resultingAccountedCashUsd: 0,
      allocationTotalPercent,
      buckets: [],
    };
  }

  /*
   * If cash decreased since the last observation, rebase
   * the accounting baseline downward.
   *
   * This prevents a later legitimate increase from being
   * permanently hidden behind an obsolete higher baseline.
   *
   * IMPORTANT:
   * The SOURCE of a future increase is NOT decided here.
   *
   * Deposit / sale / refund / transfer classification belongs
   * to a separate Multi-Asset source-safeguard layer.
   */
  const rebasedAccountedCashUsd =
    money(
      Math.min(
        accountedCashUsd,
        currentCashUsd
      )
    );

  const newUnprocessedCashUsd =
    money(
      Math.max(
        currentCashUsd -
          rebasedAccountedCashUsd,
        0
      )
    );

  /*
   * ==========================================================
   * MULTI-ASSET 100% CAPITAL COMMITMENT
   * ==========================================================
   *
   * Every genuinely new Atlas dollar is committed to the
   * client's current target portfolio.
   *
   * We deliberately DO NOT apply legacy-style deployPct here.
   *
   * This is portfolio accounting, not market-entry timing.
   *
   * Intelligence downstream decides:
   * - BUY NOW
   * - SCALE IN
   * - WAIT
   * - BLOCK
   *
   * Capital that is not yet executed remains assigned/pending.
   */
  const newlyDeployableUsd =
    money(
      newUnprocessedCashUsd
    );

  const pendingMap =
    new Map<
      string,
      number
    >();

  for (
    const pending
    of input.existingPending
  ) {
    const symbol =
      normalizeSymbol(
        pending.symbol
      );

    const amount =
      money(
        Number(
          pending.pendingUsd
        )
      );

    if (
      !symbol ||
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      continue;
    }

    pendingMap.set(
      symbol,
      amount
    );
  }

  const buckets =
    allocations.map(
      (
        allocation
      ):
        AtlasMultiAssetAccumulationBucket => {
        const previousPendingUsd =
          money(
            pendingMap.get(
              allocation.symbol
            ) ??
            0
          );

        /*
         * 100% of genuinely new cash is distributed according
         * to the client's saved 100% target allocation.
         */
        const addedPendingUsd =
          money(
            newlyDeployableUsd *
              (
                allocation.targetPercent /
                100
              )
          );

        const pendingUsd =
          money(
            previousPendingUsd +
              addedPendingUsd
          );

        /*
         * minOrderUsd is an EXECUTION-readiness threshold only.
         *
         * Amounts below this threshold remain safely pending
         * and continue accumulating across future cycles.
         */
        const executable =
          pendingUsd >=
          minOrderUsd;

        return {
          symbol:
            allocation.symbol,

          targetPercent:
            allocation.targetPercent,

          previousPendingUsd,

          addedPendingUsd,

          pendingUsd,

          executableUsd:
            executable
              ? pendingUsd
              : 0,

          executable,
        };
      }
    );

  /*
   * Once this observation has been successfully persisted,
   * the current cash becomes the accounting baseline.
   *
   * Because 100% of newUnprocessedCashUsd has now entered
   * portfolio pending state, advancing the baseline does not
   * strand an undeployed percentage of the contribution.
   *
   * A repeat cycle with unchanged cash therefore produces:
   *
   * newUnprocessedCashUsd = 0
   * newlyDeployableUsd    = 0
   *
   * Existing pending buckets remain unchanged and available
   * for downstream intelligence/execution evaluation.
   */
  const resultingAccountedCashUsd =
    currentCashUsd;

  return {
    valid: true,

    reason:
      "accumulation_ready",

    currentCashUsd,

    previousAccountedCashUsd:
      accountedCashUsd,

    rebasedAccountedCashUsd,

    newUnprocessedCashUsd,

    newlyDeployableUsd,

    resultingAccountedCashUsd,

    allocationTotalPercent,

    buckets,
  };
}