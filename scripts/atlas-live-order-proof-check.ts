/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Order Proof Check
 * ------------------------------------------------------------
 * PURPOSE
 * Verify a completed controlled live BTC proof using the
 * authoritative Coinbase order record and isolated Atlas
 * Multi-Asset pending state.
 *
 * TARGET
 * - BTC-USD
 * - Existing controlled $2.75 proof
 *
 * SAFETY
 * - GET/read-only Coinbase access
 * - No order submission
 * - No execution route call
 * - No approval mutation
 * - No authorization mutation
 * - No pending-ledger mutation
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC modification
 * ============================================================
 */

import {
  config,
} from "dotenv";

import {
  readFileSync,
} from "fs";

import {
  reconcileAtlasLiveCoinbaseOrder,
} from "../src/lib/atlas-live-order-reconciliation";

import {
  SupabaseAtlasMultiAssetStateRepository,
} from "../src/lib/repositories/atlasMultiAssetStateRepository";


config({
  path: ".env.atlas-live-check",
});


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


const PRODUCT_ID =
  "BTC-USD";


const ASSET_SYMBOL =
  "BTC";


const EXPECTED_MAX_USD =
  2.75;


function readLocalValue(
  path: string
): string {

  try {

    return readFileSync(
      path,
      "utf8"
    ).trim();

  } catch {

    return "";
  }
}


function assert(
  condition: boolean,
  message: string
): asserts condition {

  if (!condition) {
    throw new Error(
      message
    );
  }
}


async function main() {

  console.log(
    "\nATLAS LIVE ORDER PROOF CHECK"
  );

  console.log(
    "----------------------------"
  );


  /*
   * The order ID is kept in an ignored local file so it does
   * not need to be embedded in source code.
   */
  const orderId =
    readLocalValue(
      ".atlas-live-order-id.local"
    );


  assert(
    orderId.length > 5,
    "Missing .atlas-live-order-id.local"
  );


  console.log(
    "1. Coinbase order ID present: PASS"
  );


  /*
   * ========================================================
   * AUTHORITATIVE COINBASE ORDER CHECK
   * ========================================================
   *
   * GET only.
   */
  const reconciliation =
    await reconcileAtlasLiveCoinbaseOrder({
      userId:
        USER_ID,

      orderId,

      expectedProductId:
        PRODUCT_ID,
    });


  console.log(
    "\nCOINBASE RECONCILIATION"
  );

  console.log(
    JSON.stringify(
      reconciliation,
      null,
      2
    )
  );


  assert(
    reconciliation.confirmed,
    `Coinbase fill not confirmed: ${reconciliation.reason}`
  );


  assert(
    reconciliation.productId ===
      PRODUCT_ID,
    "Coinbase product mismatch"
  );


  assert(
    reconciliation.settled ===
      true,
    "Coinbase order is not settled"
  );


  assert(
    reconciliation.filledValueUsd >
      0,
    "Coinbase filled value is zero"
  );


  /*
   * The controlled proof was authorized for $2.75.
   *
   * We fail closed if Coinbase reports materially more than
   * the authorized test amount.
   */
  assert(
    reconciliation.filledValueUsd <=
      EXPECTED_MAX_USD + 0.05,
    `Filled value exceeded controlled proof amount: $${reconciliation.filledValueUsd}`
  );


  console.log(
    "2. Coinbase authoritative fill: PASS"
  );


  /*
   * ========================================================
   * ISOLATED MULTI-ASSET PENDING STATE
   * ========================================================
   *
   * READ ONLY.
   */
  const stateRepository =
    new SupabaseAtlasMultiAssetStateRepository();


  const pending =
    await stateRepository.loadPendingAllocations(
      USER_ID
    );


  const btcPending =
    pending.find(
      (
        row
      ) =>
        row.assetSymbol ===
        ASSET_SYMBOL
    );


  const remainingPendingUsd =
    btcPending?.pendingUsd ??
    0;


  console.log(
    "\nATLAS MULTI-ASSET STATE"
  );

  console.log(
    "BTC PENDING USD:",
    remainingPendingUsd
  );


  /*
   * Before the controlled proof BTC pending was $2.75.
   *
   * A successful executor reconciliation/settlement should
   * therefore leave the bucket below $2.75.
   */
  assert(
    remainingPendingUsd <
      EXPECTED_MAX_USD,
    `BTC pending bucket was not reduced. Current: $${remainingPendingUsd}`
  );


  console.log(
    "3. BTC pending settlement observed: PASS"
  );


  console.log(
    "\nPROOF"
  );

  console.log(
    "-----"
  );

  console.log(
    "PRODUCT: BTC-USD"
  );

  console.log(
    "COINBASE SETTLED: TRUE"
  );

  console.log(
    "FILLED VALUE USD:",
    reconciliation.filledValueUsd
  );

  console.log(
    "BTC PENDING USD:",
    remainingPendingUsd
  );

  console.log(
    "ORDER SUBMISSION FROM THIS SCRIPT: NO"
  );


  console.log(
    "\nRESULT: PASS — LIVE BTC FILL AND MULTI-ASSET SETTLEMENT VERIFIED"
  );
}


main().catch(
  (
    error
  ) => {

    console.error(
      "\nRESULT: FAIL"
    );

    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode = 1;
  }
);