/**
 * ============================================================
 * YieldCraft Atlas
 * Multi Asset API Flow Smoke Test
 *
 * PURPOSE
 * Validate the production Multi-Asset governance entry point
 * using authoritative per-client Atlas Coinbase funding.
 *
 * FLOW
 * Client
 * -> Atlas-scoped Coinbase credentials
 * -> Read-only Coinbase USD balance
 * -> Multi Asset Run
 * -> Portfolio Plan
 * -> Approval
 * -> Authorization
 *
 * SAFETY
 * - Uses isolated Multi-Asset run secret
 * - No caller-supplied availableCash
 * - Read-only Coinbase balance access
 * - No Coinbase order submission
 * - No execution request
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC modification
 *
 * IMPORTANT
 * This test does NOT call the protected execution route.
 * It stops after the Multi-Asset governance route returns.
 * ============================================================
 */

import { config } from "dotenv";

import {
  readFileSync,
} from "fs";


config({
  path: ".env.production.local",
});


const BASE_URL =
  "https://yieldcraft.co";


let RUN_SECRET =
  "";


try {

  RUN_SECRET =
    readFileSync(
      ".atlas-multi-asset-run-secret.local",
      "utf8"
    ).trim();

} catch {

  RUN_SECRET =
    "";
}


if (!RUN_SECRET) {
  throw new Error(
    "Missing .atlas-multi-asset-run-secret.local"
  );
}


async function post(
  url: string,
  body: unknown,
  headers: Record<string, string>
) {

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...headers,
        },

        body:
          JSON.stringify(body),
      }
    );


  const text =
    await response.text();


  let json: any;


  try {

    json =
      JSON.parse(text);

  } catch {

    json = {
      raw:
        text,
    };
  }


  console.log(
    "\nSTATUS:",
    response.status
  );


  console.log(
    JSON.stringify(
      json,
      null,
      2
    )
  );


  return json;
}


async function main() {

  console.log(
    "ATLAS MULTI ASSET PRODUCTION FUNDING TEST"
  );


  console.log(
    "-----------------------------------------"
  );


  console.log(
    "1. Multi Asset Run"
  );


  const run =
    await post(
      `${BASE_URL}/api/atlas-multi-asset-run`,

      {
        userId:
          "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e",

        deployPct:
          20,

        minCash:
          10,

        minBuy:
          10,
      },

      {
        "x-atlas-run-secret":
          RUN_SECRET,
      }
    );


  if (!run.ok) {
    throw new Error(
      "Atlas multi asset run failed"
    );
  }


  if (
    run.status !==
      "authorized_ready" &&
    run.status !==
      "blocked"
  ) {
    throw new Error(
      `Unexpected Atlas status: ${String(
        run.status
      )}`
    );
  }


  console.log(
    "RESULT: Production Multi-Asset route reached."
  );


  if (run.funding) {

    console.log(
      "FUNDING SOURCE:",
      run.funding.source ??
        "coinbase_atlas_client"
    );


    console.log(
      "USD AVAILABLE:",
      run.funding.usdAvailable
    );


    console.log(
      "USDC AVAILABLE:",
      run.funding.usdcAvailable
    );


    console.log(
      "DEPLOYABLE USD:",
      run.funding.deployableCashUsd
    );
  }


  if (
    run.status ===
    "authorized_ready"
  ) {

    console.log(
      "PORTFOLIO PLAN ID:",
      run.plan?.portfolioPlanId
    );


    console.log(
      "APPROVAL ID:",
      run.governance?.approval?.approvalId ??
      run.governance?.approvalId
    );


    console.log(
      "AUTHORIZATION ID:",
      run.governance?.authorization?.authorizationId ??
      run.governance?.authorizationId
    );
  }
}


main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );


  console.error(error);


  process.exitCode = 1;
});