/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Equity Tradability Smoke Test
 *
 * PURPOSE
 * Verify the authoritative Coinbase product state for
 * Atlas equity products before wiring the gate into execution.
 *
 * TARGETS
 * - AAPL
 * - SPCX / SpaceX
 *
 * SAFETY
 * - GET only
 * - No orders
 * - No execution
 * - No approval mutation
 * - No authorization mutation
 * - No Supabase mutation
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC
 * ============================================================
 */

import {
  config,
} from "dotenv";

import {
  evaluateAtlasEquityTradability,
} from "../src/lib/atlas-equity-tradability-gate";

import {
  getAtlasAsset,
} from "../src/lib/atlas-assets";


config({
  path: ".env.production.local",
});


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


async function testAsset(
  atlasSymbol: string
) {

  const asset =
    getAtlasAsset(
      atlasSymbol
    );


  if (!asset) {
    throw new Error(
      `atlas_asset_missing:${atlasSymbol}`
    );
  }


  if (!asset.usdPair) {
    throw new Error(
      `atlas_usd_product_missing:${atlasSymbol}`
    );
  }


  console.log(
    `\n===== ${atlasSymbol} =====`
  );


  console.log(
    "PRODUCT ID:",
    asset.usdPair
  );


  const result =
    await evaluateAtlasEquityTradability(
      USER_ID,
      asset.usdPair
    );


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


async function main() {

  console.log(
    "\nATLAS EQUITY TRADABILITY SMOKE TEST"
  );

  console.log(
    "-----------------------------------"
  );

  console.log(
    "MODE: READ ONLY"
  );


  const aapl =
    await testAsset(
      "AAPL"
    );


  const spacex =
    await testAsset(
      "SPACEX"
    );


  console.log(
    "\nSUMMARY"
  );

  console.log(
    "-------"
  );

  console.log(
    "AAPL:",
    aapl.allowed
      ? "READY"
      : `BLOCKED (${aapl.reason})`
  );


  console.log(
    "SPACEX:",
    spacex.allowed
      ? "READY"
      : `BLOCKED (${spacex.reason})`
  );


  console.log(
    "\nRESULT: READ-ONLY EQUITY GATE TEST COMPLETE"
  );
}


main().catch(
  (error) => {

    console.error(
      "\nRESULT: FAIL"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);