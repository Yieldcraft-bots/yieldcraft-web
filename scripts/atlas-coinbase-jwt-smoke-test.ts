/**
 * ============================================================
 * YieldCraft Atlas
 * Coinbase JWT Smoke Test
 *
 * PURPOSE
 * Verify Atlas-only Coinbase JWT creation.
 *
 * SAFETY
 * - No order submission
 * - No Coinbase trade
 * - No Pulse
 * - No Recon
 * - No live execution
 * ============================================================
 */

import { config } from "dotenv";

import {
  createAtlasCoinbaseJwt,
} from "../src/lib/atlas-live-coinbase-jwt";


config({
  path: ".env.local",
});


async function main() {

  console.log(
    "ATLAS COINBASE JWT SMOKE TEST"
  );

  console.log(
    "-----------------------------"
  );


  const jwt =
    await createAtlasCoinbaseJwt(
      "POST",
      "/api/v3/brokerage/orders"
    );


  if (!jwt) {
    throw new Error(
      "JWT creation failed"
    );
  }


  console.log(
    "1. Atlas JWT creation: PASS"
  );


  console.log(
    "RESULT: PASS — Atlas Coinbase authentication boundary ready."
  );
}


main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;

});