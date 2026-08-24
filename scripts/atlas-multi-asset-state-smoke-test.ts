/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Persistent State Smoke Test
 * ------------------------------------------------------------
 * PROVES
 * - isolated Multi-Asset cash state persists
 * - isolated pending buckets persist
 * - same cash is not redeployed twice
 *
 * SAFETY
 * - Uses only new Multi-Asset state tables
 * - No Coinbase
 * - No orders
 * - No approvals
 * - No authorization
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import { config } from "dotenv";

import {
  processAtlasMultiAssetAccumulation,
} from "../src/lib/atlas-multi-asset-state-service";

import {
  SupabaseAtlasMultiAssetStateRepository,
} from "../src/lib/repositories/atlasMultiAssetStateRepository";


config({
  path: ".env.production.local",
});


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


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
    "ATLAS MULTI-ASSET STATE SMOKE TEST"
  );

  console.log(
    "----------------------------------"
  );


  const repository =
    new SupabaseAtlasMultiAssetStateRepository();


  /*
   * Use a deliberately tiny synthetic allocation.
   *
   * This test DOES write Multi-Asset state rows,
   * but performs no trading and no Coinbase calls.
   */
  const allocationRows: any[] = [
    {
      asset_symbol: "BTC",
      target_percent: 50,
    },
    {
      asset_symbol: "ETH",
      target_percent: 50,
    },
  ];


  /*
   * Reset ONLY this user's isolated Multi-Asset
   * state used by this test.
   */
  await repository.setPendingAllocation({
    userId: USER_ID,
    assetSymbol: "BTC",
    pendingUsd: 0,
  });

  await repository.setPendingAllocation({
    userId: USER_ID,
    assetSymbol: "ETH",
    pendingUsd: 0,
  });

  await repository.saveCashState({
    userId: USER_ID,
    lastObservedCashUsd: 0,
    accountedCashUsd: 0,
    lastProcessedCashUsd: 0,
    lastProcessedAt: null,
  });


  console.log(
    "1. Isolated state reset: PASS"
  );


  const first =
    await processAtlasMultiAssetAccumulation({
      userId: USER_ID,
      currentCashUsd: 55,
      deployPct: 20,
      minOrderUsd: 10,
      allocationRows,
    });


  assert(
    first.persisted === true,
    "First accumulation did not persist."
  );

  assert(
    first.accumulation.newlyDeployableUsd === 11,
    "Expected first deployable amount to equal $11."
  );


  console.log(
    "2. First $55 observation persisted: PASS"
  );


  const pendingAfterFirst =
    await repository.loadPendingAllocations(
      USER_ID
    );


  const btcFirst =
    pendingAfterFirst.find(
      (row) =>
        row.assetSymbol === "BTC"
    );


  const ethFirst =
    pendingAfterFirst.find(
      (row) =>
        row.assetSymbol === "ETH"
    );


  assert(
    btcFirst?.pendingUsd === 5.5,
    "Expected BTC pending = $5.50."
  );


  assert(
    ethFirst?.pendingUsd === 5.5,
    "Expected ETH pending = $5.50."
  );


  console.log(
    "3. Pending buckets persisted: PASS"
  );


  const second =
    await processAtlasMultiAssetAccumulation({
      userId: USER_ID,
      currentCashUsd: 55,
      deployPct: 20,
      minOrderUsd: 10,
      allocationRows,
    });


  assert(
    second.persisted === true,
    "Second accumulation did not persist."
  );


  assert(
    second.accumulation.newUnprocessedCashUsd === 0,
    "Same cash must not be recognized as new."
  );


  assert(
    second.accumulation.newlyDeployableUsd === 0,
    "Same cash must not create another deployment."
  );


  const pendingAfterSecond =
    await repository.loadPendingAllocations(
      USER_ID
    );


  const btcSecond =
    pendingAfterSecond.find(
      (row) =>
        row.assetSymbol === "BTC"
    );


  const ethSecond =
    pendingAfterSecond.find(
      (row) =>
        row.assetSymbol === "ETH"
    );


  assert(
    btcSecond?.pendingUsd === 5.5,
    "BTC pending changed on duplicate cash observation."
  );


  assert(
    ethSecond?.pendingUsd === 5.5,
    "ETH pending changed on duplicate cash observation."
  );


  console.log(
    "4. Same $55 observation produced $0 redeployment: PASS"
  );


  console.log(
    ""
  );


  console.log(
    "RESULT: PASS — persistent duplicate-cash protection healthy."
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