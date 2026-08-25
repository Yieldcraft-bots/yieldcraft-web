/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Production Shadow Execution Proof
 * ------------------------------------------------------------
 * PURPOSE
 * Prove the deployed protected execution route remains in
 * SHADOW mode while ATLAS_DRY_RUN is enabled.
 *
 * TARGET
 * - Existing approved/authorized Atlas Multi-Asset plan
 * - BTC-USD only
 * - $2.75 executable instruction
 *
 * SAFETY
 * - Production route
 * - Existing approval required
 * - Existing authorization required
 * - Requests BTC-USD only
 * - Expects shadow mode
 * - Requires deployed server liveEnabled=false
 * - Requires exactly one dispatched instruction
 * - Never prints operator token
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  config,
} from "dotenv";

import {
  readFileSync,
} from "fs";


config({
  path: ".env.production.local",
});


const BASE_URL =
  "https://yieldcraft.co";


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


const APPROVAL_ID =
  "d59ca63e-5c06-42c7-a00d-09511260f4d9";


const AUTHORIZATION_ID =
  "9ebaa43f-2c6e-4115-9352-bbe67e4347d9";


const PRODUCT_ID =
  "BTC-USD";


function record(
  value: unknown
): Record<string, unknown> | null {

  return (
    typeof value === "object" &&
    value !== null
  )
    ? value as Record<string, unknown>
    : null;
}


function loadOperatorToken(): string {

  try {

    return readFileSync(
      ".atlas-operator-token.local",
      "utf8"
    ).trim();

  } catch {

    return "";
  }
}


async function main() {

  console.log(
    "\nATLAS PRODUCTION SHADOW EXECUTION PROOF"
  );

  console.log(
    "---------------------------------------"
  );

  console.log(
    "TARGET PRODUCT:",
    PRODUCT_ID
  );


  const operatorToken =
    loadOperatorToken();


  if (!operatorToken) {
    throw new Error(
      "Missing .atlas-operator-token.local"
    );
  }


  /*
   * Local pre-flight safety check.
   *
   * The request is refused unless our local Production
   * configuration explicitly remains in dry-run mode.
   */
  if (
    process.env.ATLAS_DRY_RUN !==
    "true"
  ) {
    throw new Error(
      "SAFETY BLOCK: ATLAS_DRY_RUN is not true"
    );
  }


  console.log(
    "LOCAL DRY-RUN PREFLIGHT: PASS"
  );


  /*
   * Call the protected Production execution route.
   *
   * productId can only narrow the already-approved and
   * already-authorized persisted plan.
   */
  const response =
    await fetch(
      `${BASE_URL}/api/operator/atlas-execution-run`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-atlas-operator-token":
            operatorToken,
        },

        body:
          JSON.stringify({
            userId:
              USER_ID,

            approvalId:
              APPROVAL_ID,

            authorizationId:
              AUTHORIZATION_ID,

            productId:
              PRODUCT_ID,
          }),
      }
    );


  const text =
    await response.text();


  let data: unknown;


  try {

    data =
      JSON.parse(
        text
      );

  } catch {

    data = {
      raw:
        text,
    };
  }


  console.log(
    "HTTP STATUS:",
    response.status
  );


  console.log(
    JSON.stringify(
      data,
      null,
      2
    )
  );


  if (!response.ok) {
    throw new Error(
      `Production execution route returned HTTP ${response.status}`
    );
  }


  const root =
    record(
      data
    );


  if (!root) {
    throw new Error(
      "Invalid production execution response"
    );
  }


  /*
   * ========================================================
   * SERVER MODE PROOF
   * ========================================================
   */

  if (
    root.mode !==
    "shadow"
  ) {
    throw new Error(
      `SAFETY FAILURE: Expected shadow mode, received ${String(
        root.mode
      )}`
    );
  }


  const safety =
    record(
      root.safety
    );


  if (!safety) {
    throw new Error(
      "Missing Production safety result"
    );
  }


  if (
    safety.liveEnabled !==
    false
  ) {
    throw new Error(
      `SAFETY FAILURE: Expected liveEnabled=false, received ${String(
        safety.liveEnabled
      )}`
    );
  }


  if (
    safety.dryRun !==
    true
  ) {
    throw new Error(
      `SAFETY FAILURE: Expected dryRun=true, received ${String(
        safety.dryRun
      )}`
    );
  }


  if (
    safety.controlledProduct !==
    PRODUCT_ID
  ) {
    throw new Error(
      `SAFETY FAILURE: Expected controlled product ${PRODUCT_ID}, received ${String(
        safety.controlledProduct
      )}`
    );
  }


  if (
    safety.dispatchedInstructions !==
    1
  ) {
    throw new Error(
      `SAFETY FAILURE: Expected exactly one dispatched instruction, received ${String(
        safety.dispatchedInstructions
      )}`
    );
  }


  /*
   * ========================================================
   * AUTHORIZED INSTRUCTION PROOF
   * ========================================================
   */

  const selectedInstructions =
    Array.isArray(
      root.selectedInstructions
    )
      ? root.selectedInstructions
      : [];


  if (
    selectedInstructions.length !==
    1
  ) {
    throw new Error(
      `Expected exactly one selected instruction; found ${selectedInstructions.length}`
    );
  }


  const selectedInstruction =
    record(
      selectedInstructions[0]
    );


  if (!selectedInstruction) {
    throw new Error(
      "Selected instruction is invalid"
    );
  }


  if (
    selectedInstruction.productId !==
    PRODUCT_ID
  ) {
    throw new Error(
      `Expected ${PRODUCT_ID}; received ${String(
        selectedInstruction.productId
      )}`
    );
  }


  if (
    Number(
      selectedInstruction.quoteSizeUsd
    ) !== 2.75
  ) {
    throw new Error(
      `Expected $2.75 quote size; received ${String(
        selectedInstruction.quoteSizeUsd
      )}`
    );
  }


  console.log(
    "\nSAFETY RESULT"
  );

  console.log(
    "-------------"
  );

  console.log(
    "SERVER MODE: SHADOW"
  );

  console.log(
    "SERVER DRY RUN: TRUE"
  );

  console.log(
    "LIVE ENABLED: FALSE"
  );

  console.log(
    "DISPATCHED INSTRUCTIONS: 1"
  );

  console.log(
    "TARGET: BTC-USD"
  );

  console.log(
    "ORDER VALUE: $2.75"
  );

  console.log(
    "\nRESULT: PASS — PRODUCTION SHADOW BOUNDARY PROVEN"
  );
}


main().catch(
  (error) => {

    console.error(
      "\nRESULT: FAIL"
    );

    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode = 1;
  }
);