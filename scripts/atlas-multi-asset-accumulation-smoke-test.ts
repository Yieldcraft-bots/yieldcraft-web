/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Accumulation Engine Smoke Test
 * ------------------------------------------------------------
 * PROVES
 * 1. First $55 observation recognizes $55 new cash
 * 2. 20% deployment produces $11 deployable
 * 3. Second observation of SAME $55 produces $0 new deployment
 * 4. Later increase to $75 recognizes ONLY the new $20
 * 5. 20% of that $20 produces ONLY $4 new deployment
 *
 * SAFETY
 * - Pure calculation
 * - No Supabase
 * - No Coinbase
 * - No orders
 * - No execution
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  calculateAtlasMultiAssetAccumulation,
} from "../src/lib/atlas-multi-asset-accumulation";


function assert(
  condition: boolean,
  message: string
) {
  if (!condition) {
    throw new Error(message);
  }
}


async function main() {

  console.log(
    "ATLAS MULTI-ASSET ACCUMULATION SMOKE TEST"
  );

  console.log(
    "-----------------------------------------"
  );


  const allocations = [
    {
      symbol: "BTC",
      targetPercent: 50,
    },
    {
      symbol: "ETH",
      targetPercent: 50,
    },
  ];


  /*
   * TEST 1
   *
   * First observation:
   *
   * Coinbase cash = $55
   * Previously accounted = $0
   *
   * New cash = $55
   * Deploy 20% = $11
   */
  const first =
    calculateAtlasMultiAssetAccumulation({
      currentCashUsd: 55,
      accountedCashUsd: 0,
      deployPct: 20,
      minOrderUsd: 10,
      allocations,
      existingPending: [],
    });


  assert(
    first.valid,
    "First accumulation should be valid."
  );


  assert(
    first.newUnprocessedCashUsd === 55,
    `Expected $55 new cash, received ${first.newUnprocessedCashUsd}`
  );


  assert(
    first.newlyDeployableUsd === 11,
    `Expected $11 deployable, received ${first.newlyDeployableUsd}`
  );


  assert(
    first.resultingAccountedCashUsd === 55,
    "First accounting baseline should become $55."
  );


  assert(
    first.buckets[0]?.pendingUsd === 5.5,
    "BTC pending should be $5.50."
  );


  assert(
    first.buckets[1]?.pendingUsd === 5.5,
    "ETH pending should be $5.50."
  );


  assert(
    first.buckets.every(
      (bucket) =>
        bucket.executable === false
    ),
    "Neither $5.50 bucket should execute yet."
  );


  console.log(
    "1. First $55 observation -> $11 deployable: PASS"
  );


  /*
   * TEST 2
   *
   * SAME Coinbase balance on next cron.
   *
   * This is the critical duplicate-deployment test.
   */
  const second =
    calculateAtlasMultiAssetAccumulation({
      currentCashUsd: 55,
      accountedCashUsd:
        first.resultingAccountedCashUsd,
      deployPct: 20,
      minOrderUsd: 10,
      allocations,
      existingPending:
        first.buckets.map(
          (bucket) => ({
            symbol:
              bucket.symbol,
            pendingUsd:
              bucket.pendingUsd,
          })
        ),
    });


  assert(
    second.valid,
    "Second accumulation should be valid."
  );


  assert(
    second.newUnprocessedCashUsd === 0,
    `Expected $0 new cash, received ${second.newUnprocessedCashUsd}`
  );


  assert(
    second.newlyDeployableUsd === 0,
    `Expected $0 new deployment, received ${second.newlyDeployableUsd}`
  );


  assert(
    second.buckets[0]?.pendingUsd === 5.5 &&
    second.buckets[1]?.pendingUsd === 5.5,
    "Pending balances must remain unchanged."
  );


  console.log(
    "2. Same $55 observed again -> $0 redeployed: PASS"
  );


  /*
   * TEST 3
   *
   * Coinbase USD later rises from $55 to $75.
   *
   * Only the $20 increase is new.
   *
   * 20% of $20 = $4.
   *
   * At 50/50 allocation:
   * BTC gets another $2.
   * ETH gets another $2.
   *
   * Existing $5.50 buckets become $7.50.
   */
  const third =
    calculateAtlasMultiAssetAccumulation({
      currentCashUsd: 75,
      accountedCashUsd:
        second.resultingAccountedCashUsd,
      deployPct: 20,
      minOrderUsd: 10,
      allocations,
      existingPending:
        second.buckets.map(
          (bucket) => ({
            symbol:
              bucket.symbol,
            pendingUsd:
              bucket.pendingUsd,
          })
        ),
    });


  assert(
    third.valid,
    "Third accumulation should be valid."
  );


  assert(
    third.newUnprocessedCashUsd === 20,
    `Expected only $20 new cash, received ${third.newUnprocessedCashUsd}`
  );


  assert(
    third.newlyDeployableUsd === 4,
    `Expected only $4 deployable, received ${third.newlyDeployableUsd}`
  );


  assert(
    third.buckets[0]?.pendingUsd === 7.5 &&
    third.buckets[1]?.pendingUsd === 7.5,
    "Pending balances should accumulate to $7.50 each."
  );


  assert(
    third.resultingAccountedCashUsd === 75,
    "Accounting baseline should become $75."
  );


  console.log(
    "3. Cash rises $55 -> $75 -> only $20 recognized: PASS"
  );


  console.log(
    "4. Only $4 additional deployment generated: PASS"
  );


  console.log(
    "5. Pending allocation accumulation: PASS"
  );


  console.log(
    ""
  );


  console.log(
    "RESULT: PASS — duplicate cash deployment protection healthy."
  );
}


main().catch(
  (error) => {

    console.error(
      "RESULT: FAIL"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);