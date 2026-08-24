/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Pending Allocation Accumulation Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Convert newly observed/unprocessed USD cash into deterministic
 * per-asset pending allocation balances.
 *
 * SAFETY
 * - Pure calculation only
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
 * sale, refund, or other source.
 *
 * It only prevents the SAME observed cash from being allocated
 * repeatedly across automation cycles.
 *
 * Sell/deposit-source safeguards remain a separate launch gate.
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
   * Sell/deposit classification belongs to a separate gate.
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
   * Apply deployment intelligence ONLY to genuinely
   * unprocessed cash.
   *
   * The same unchanged Coinbase cash therefore cannot
   * generate another deployment amount on the next cron.
   */
  const newlyDeployableUsd =
    money(
      newUnprocessedCashUsd *
      (
        deployPct /
        100
      )
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
   * A repeat cron with unchanged cash therefore produces:
   *
   * newUnprocessedCashUsd = 0
   * newlyDeployableUsd    = 0
   *
   * Existing pending buckets remain unchanged.
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