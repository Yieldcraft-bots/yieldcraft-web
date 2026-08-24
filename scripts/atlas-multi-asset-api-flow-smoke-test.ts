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


config({
  path: ".env.production.local",
});


const BASE_URL =
  "https://yieldcraft.co";


const RUN_SECRET =
  process.env.ATLAS_RUN_SECRET?.trim() ||
  process.env.CRON_SECRET?.trim() ||
  "";


if (!RUN_SECRET) {
  throw new Error(
    "Missing ATLAS_RUN_SECRET or CRON_SECRET"
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


  const json =
    await response.json();


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
          "295165f4-df46-403f-8727-80408d6a2578",

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
}


main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );


  console.error(error);


  process.exitCode = 1;
});