/**
 * ============================================================
 * YieldCraft Atlas
 * Multi Asset API Flow Smoke Test
 *
 * PURPOSE
 * Validate API-level governance chain only.
 *
 * FLOW
 * Multi Asset Run
 * -> Approval Required
 * -> Operator Approval
 * -> Authorization
 * -> Protected Execution Run
 * -> Shadow Result
 *
 * SAFETY
 * - No Coinbase submission
 * - No Pulse
 * - No Recon
 * - No live execution
 * - ATLAS_LIVE_ARMED must remain false
 * ============================================================
 */

import { config } from "dotenv";

config({
  path: ".env.local",
});

const BASE_URL =
  "http://localhost:3000";

const RUN_SECRET =
  process.env.ATLAS_RUN_SECRET ?? "";

const OPERATOR_TOKEN =
  process.env.ATLAS_APPROVAL_OPERATOR_TOKEN ?? "";

if (!RUN_SECRET) {
  throw new Error(
    "Missing ATLAS_RUN_SECRET"
  );
}

if (!OPERATOR_TOKEN) {
  throw new Error(
    "Missing ATLAS_APPROVAL_OPERATOR_TOKEN"
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
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
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
    "ATLAS MULTI ASSET API FLOW TEST"
  );

  console.log(
    "--------------------------------"
  );

  if (
    process.env.ATLAS_LIVE_ARMED === "true"
  ) {
    throw new Error(
      "ABORT: ATLAS_LIVE_ARMED is true"
    );
  }

  console.log(
    "1. Multi Asset Run"
  );

  const run =
    await post(
      `${BASE_URL}/api/atlas-multi-asset-run`,
      {
        userId:
          "295165f4-df46-403f-8727-80408d6a2578",

        fundingCurrency:
          "USD",

        availableCash:
          100,

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

  if (
    !run.ok
  ) {
    throw new Error(
      "Atlas multi asset run failed"
    );
  }

  console.log(
    "RESULT: API flow reached."
  );
}

main().catch((error) => {
  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;
});