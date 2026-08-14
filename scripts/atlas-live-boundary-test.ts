/**
 * ============================================================
 * YieldCraft Atlas
 * Live Boundary Safety Test
 *
 * PURPOSE
 * Verify Atlas live execution protections.
 *
 * TESTS
 * - Live disabled blocks execution
 * - Invalid authorization blocks execution
 * - Authorized path reaches live boundary
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
  evaluateAtlasLiveExecutionGateway,
} from "../src/lib/atlas-live-execution-gateway";

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

  const instruction: AtlasExecutionInstruction = {
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
        "Atlas live boundary test",
    };


  console.log(
    "ATLAS_LIVE_BOUNDARY_TEST"
  );

  console.log(
    "----------------------------"
  );


  process.env.ATLAS_LIVE_ARMED =
    "false";


  const blocked =
    evaluateAtlasLiveExecutionGateway(
      authorization,
      instruction
    );


  assert(
    blocked.allowed === false,
    "Live disabled should block."
  );


  console.log(
    "1. Live disabled block: PASS"
  );


  process.env.ATLAS_LIVE_ARMED =
    "true";


  const allowed =
    evaluateAtlasLiveExecutionGateway(
      authorization,
      instruction
    );


  assert(
    allowed.allowed === true,
    "Authorized live gateway should allow."
  );


  console.log(
    "2. Authorized gateway: PASS"
  );


  const revoked =
    evaluateAtlasLiveExecutionGateway(
      {
        ...authorization,
        status: "REVOKED",
      },
      instruction
    );


  assert(
    revoked.allowed === false,
    "Revoked authorization should block."
  );


  console.log(
    "3. Revoked authorization block: PASS"
  );


  console.log(
    "RESULT: PASS — Atlas live boundary protections healthy."
  );
}


main().catch((error) => {
  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;
});