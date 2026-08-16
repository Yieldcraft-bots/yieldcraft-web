/**
 * ============================================================
 * YieldCraft Atlas
 * Live Idempotency Safety Test
 *
 * PURPOSE
 * Verify duplicate execution fingerprints are detected.
 *
 * TESTS
 * - Same execution inputs create same fingerprint
 * - Duplicate fingerprint can be identified
 *
 * SAFETY
 * - No Coinbase
 * - No execution
 * - No Pulse
 * - No Recon
 * - Test only
 * ============================================================
 */


import {
  createAtlasExecutionFingerprint,
} from "../src/lib/atlas-live-execution-idempotency";



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
    "ATLAS LIVE IDEMPOTENCY SAFETY TEST"
  );

  console.log(
    "----------------------------------"
  );


  const input = {
    userId:
      "test-user-001",

    authorizationId:
      "authorization-001",

    productId:
      "BTC-USD",

    quoteSizeUsd:
      10,
  };


  const firstFingerprint =
    createAtlasExecutionFingerprint(
      input
    );


  const secondFingerprint =
    createAtlasExecutionFingerprint(
      input
    );



  assert(
    firstFingerprint === secondFingerprint,
    "Same execution must create identical fingerprint."
  );


  console.log(
    "1. Duplicate fingerprint detection: PASS"
  );


  const differentFingerprint =
    createAtlasExecutionFingerprint({
      ...input,
      quoteSizeUsd: 20,
    });



  assert(
    firstFingerprint !== differentFingerprint,
    "Different execution should create different fingerprint."
  );


  console.log(
    "2. Unique execution fingerprint: PASS"
  );


  console.log(
    "RESULT: PASS — Atlas idempotency protection healthy."
  );
}



main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;

});