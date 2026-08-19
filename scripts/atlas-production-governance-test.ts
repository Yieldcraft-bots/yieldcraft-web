/**
 * ============================================================
 * YieldCraft Atlas
 * Production Governance Smoke Test
 *
 * PURPOSE
 * Verify production Atlas governance route.
 *
 * SAFETY
 * - No live execution
 * - No Coinbase
 * - No orders
 * - No Pulse
 * - No Recon
 *
 * This only creates governance state.
 * ============================================================
 */

import { config } from "dotenv";

config({
  path: ".env.local",
});

const RUN_SECRET =
  process.env.ATLAS_RUN_SECRET ?? "";

if (!RUN_SECRET) {
  throw new Error(
    "ATLAS_RUN_SECRET missing"
  );
}

const userId =
  "295165f4-df46-403f-8727-80408d6a2578";

async function main() {
  console.log(
    "ATLAS PRODUCTION GOVERNANCE TEST"
  );
  console.log(
    "--------------------------------"
  );

  const response =
    await fetch(
      "https://yieldcraft.co/api/atlas-run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-atlas-run-secret":
            RUN_SECRET,
        },
        body: JSON.stringify({
          userId,
          fundingCurrency: "USD",
          availableCash: 100,
          deployPct: 20,
          minCash: 10,
          minBuy: 10,
        }),
      }
    );

  const result =
    await response.json();

  console.log(
    "STATUS:",
    response.status
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;
});