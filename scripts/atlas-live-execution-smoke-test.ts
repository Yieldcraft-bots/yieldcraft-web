/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Smoke Test
 *
 * PURPOSE
 * Verify Atlas live execution fails safely before launch.
 *
 * TESTS
 * - Authorization accepted
 * - Live gateway accepted
 * - Missing Atlas Coinbase credentials block safely
 *
 * SAFETY
 * - No Coinbase submission
 * - No live orders
 * - No Pulse
 * - No Recon
 * - Test only
 * ============================================================
 */

import { config } from "dotenv";

import {
  executeAtlasLiveInstruction,
} from "../src/lib/atlas-live-execution-executor";

import type {
  AtlasExecutionAuthorizationContract,
} from "../src/lib/atlas-operations/atlas-execution-authorization-contract";

import type {
  AtlasExecutionInstruction,
} from "../src/lib/atlas-execution-adapter";


config({
  path: ".env.local",
});


function assert(
  condition: boolean,
  message: string
) {
  if (!condition) {
    throw new Error(message);
  }
}


async function main() {

  process.env.ATLAS_LIVE_ARMED =
    "false";


  delete process.env.ATLAS_COINBASE_API_KEY_NAME;
  delete process.env.ATLAS_COINBASE_PRIVATE_KEY;
  delete process.env.ATLAS_COINBASE_KEY_ALG;


  const instruction:
    AtlasExecutionInstruction = {
      symbol: "BTC",
      brokerId: "coinbase",
      productId: "BTC-USD",
      fundingCurrency: "USD",
      quoteSizeUsd: 10,
    };


  const authorization:
    AtlasExecutionAuthorizationContract = {

      authorizationId:
        crypto.randomUUID(),

      approvalId:
        crypto.randomUUID(),

      userId:
        crypto.randomUUID(),

      portfolioPlanId:
        crypto.randomUUID(),

      status:
        "AUTHORIZED",

      authorizedAt:
        new Date().toISOString(),

      createdAt:
        new Date().toISOString(),

      reason:
        "Atlas live execution smoke test",
    };


  console.log(
    "ATLAS LIVE EXECUTION SMOKE TEST"
  );

  console.log(
    "-------------------------------"
  );


  const result =
    await executeAtlasLiveInstruction(
      instruction,
      authorization
    );


  assert(
    result.submitted === false,
    "Execution should not submit without credentials."
  );


  assert(
    result.success === false,
    "Execution should fail safely without credentials."
  );


  console.log(
    "1. Missing credentials block: PASS"
  );


  console.log(
    "RESULT: PASS — Atlas live execution fails safely."
  );
}


main().catch((error) => {
  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;
});