/**
 * ============================================================
 * YieldCraft Atlas
 * Live Failure Safety Test
 *
 * PURPOSE
 * Verify Atlas live execution fails safely.
 *
 * TESTS
 * - Coinbase rejection does not submit
 * - Failed execution returns safe result
 *
 * SAFETY
 * - No real Coinbase orders
 * - No Pulse
 * - No Recon
 * - No UI
 * ============================================================
 */

import {
  submitAtlasLiveCoinbaseOrder,
} from "../src/lib/atlas-live-coinbase-adapter";


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
    "ATLAS LIVE FAILURE SAFETY TEST"
  );

  console.log(
    "-----------------------------"
  );


  const originalFetch =
    global.fetch;


  global.fetch =
    async () =>
      new Response(
        JSON.stringify({
          error:
            "simulated_coinbase_rejection",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );


  const result =
    await submitAtlasLiveCoinbaseOrder(
      {
        symbol: "BTC",
        brokerId: "coinbase",
        productId: "BTC-USD",
        fundingCurrency: "USD",
        quoteSizeUsd: 10,
      },
      {
        apiKey: "test",
        jwt: "test",
      },
      "failure-test-user"
    );


  assert(
    result.submitted === false,
    "Rejected Coinbase order must not submit."
  );


  assert(
    result.success === false,
    "Rejected Coinbase order must fail."
  );


  console.log(
    "1. Coinbase rejection block: PASS"
  );


  global.fetch =
    originalFetch;


  console.log(
    "RESULT: PASS — Atlas failure handling is safe."
  );
}


main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;

});