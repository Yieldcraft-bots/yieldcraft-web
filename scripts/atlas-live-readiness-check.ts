/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Readiness Check
 * ------------------------------------------------------------
 * PURPOSE
 * Verify that the controlled BTC live proof is ready without
 * submitting any Coinbase order.
 *
 * TARGET
 * - Existing approved/authorized plan
 * - BTC-USD only
 * - $2.75 instruction
 *
 * SAFETY
 * - No Coinbase POST
 * - No order submission
 * - No execution route call
 * - No approval mutation
 * - No authorization mutation
 * - No pending-ledger mutation
 * - No Pulse
 * - No Recon
 * - No legacy Atlas BTC modification
 * ============================================================
 */

import {
  config,
} from "dotenv";

import {
  readFileSync,
} from "fs";

import {
  SupabaseAtlasApprovalRepository,
} from "../src/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "../src/lib/repositories/atlasExecutionAuthorizationRepository";

import {
  loadAtlasPortfolioPlan,
} from "../src/lib/repositories/atlasPortfolioPlanRepository";

import {
  buildAtlasExecutionInstructions,
} from "../src/lib/atlas-execution-adapter";

import {
  evaluateAtlasExecutionAuthorizationGate,
} from "../src/lib/atlas-operations";


config({
  path: ".env.atlas-live-check",
});


const USER_ID =
  "8b0def33-f6cd-48c5-8029-6e7b59b5ae8e";


const APPROVAL_ID =
  "d59ca63e-5c06-42c7-a00d-09511260f4d9";


const AUTHORIZATION_ID =
  "9ebaa43f-2c6e-4115-9352-bbe67e4347d9";


const PRODUCT_ID =
  "BTC-USD";


const EXPECTED_QUOTE_USD =
  2.75;


function readSecretFile(
  path: string
): string {

  try {

    return readFileSync(
      path,
      "utf8"
    ).trim();

  } catch {

    return "";
  }
}


function assert(
  condition: boolean,
  message: string
): asserts condition {

  if (!condition) {
    throw new Error(
      message
    );
  }
}


async function main() {

  console.log(
    "\nATLAS LIVE READINESS CHECK"
  );

  console.log(
    "--------------------------"
  );


  /*
   * ========================================================
   * PRODUCTION SAFETY FLAGS
   * ========================================================
   */

  const liveArmed =
    process.env
      .ATLAS_LIVE_ARMED ===
    "true";


  const dryRunDisabled =
    process.env
      .ATLAS_DRY_RUN ===
    "false";


  assert(
    liveArmed,
    "ATLAS_LIVE_ARMED is not true"
  );


  assert(
    dryRunDisabled,
    "ATLAS_DRY_RUN is not false"
  );


  console.log(
    "1. Production live flags: PASS"
  );


  /*
   * ========================================================
   * LOCAL OPERATOR SECRET FILES
   * ========================================================
   */

  const operatorToken =
    readSecretFile(
      ".atlas-operator-token.local"
    );


  const runSecret =
    readSecretFile(
      ".atlas-multi-asset-run-secret.local"
    );


  assert(
    operatorToken.length > 20,
    "Local operator token missing"
  );


  assert(
    runSecret.length > 20,
    "Local Multi-Asset run secret missing"
  );


  console.log(
    "2. Local secret files: PASS"
  );


  /*
   * ========================================================
   * APPROVAL
   * ========================================================
   */

  const approvalRepository =
    new SupabaseAtlasApprovalRepository();


  const approval =
    await approvalRepository.load(
      APPROVAL_ID,
      USER_ID
    );


  assert(
    approval !== null,
    "Approval not found"
  );


  assert(
    approval.status ===
      "APPROVED",
    "Approval is not APPROVED"
  );


  console.log(
    "3. Approval: PASS"
  );


  /*
   * ========================================================
   * AUTHORIZATION
   * ========================================================
   */

  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();


  const authorization =
    await authorizationRepository.load(
      AUTHORIZATION_ID,
      USER_ID
    );


  assert(
    authorization !== null,
    "Authorization not found"
  );


  assert(
    authorization.status ===
      "AUTHORIZED",
    "Authorization is not AUTHORIZED"
  );


  assert(
    authorization.approvalId ===
      APPROVAL_ID,
    "Authorization does not belong to approval"
  );


  assert(
    authorization.portfolioPlanId ===
      approval.portfolioPlanId,
    "Approval/authorization plan mismatch"
  );


  console.log(
    "4. Authorization binding: PASS"
  );


  /*
   * ========================================================
   * EXECUTION GATE
   * ========================================================
   */

  const gate =
    evaluateAtlasExecutionAuthorizationGate(
      authorization
    );


  assert(
    gate.authorized,
    `Execution gate blocked: ${gate.reason}`
  );


  console.log(
    "5. Execution authorization gate: PASS"
  );


  /*
   * ========================================================
   * PERSISTED PLAN
   * ========================================================
   */

  const storedPlan =
    await loadAtlasPortfolioPlan(
      authorization.portfolioPlanId
    );


  assert(
    storedPlan !== null,
    "Portfolio plan not found"
  );


  const execution =
    buildAtlasExecutionInstructions(
      storedPlan.plan
    );


  assert(
    execution.executable,
    "Portfolio plan has no executable instructions"
  );


  /*
   * Exact controlled instruction only.
   */
  const matches =
    execution.instructions.filter(
      (
        instruction
      ) =>
        instruction.productId ===
        PRODUCT_ID
    );


  assert(
    matches.length === 1,
    `Expected exactly one ${PRODUCT_ID} instruction; found ${matches.length}`
  );


  const instruction =
    matches[0];


  assert(
    instruction.symbol ===
      "BTC",
    `Expected BTC symbol; received ${instruction.symbol}`
  );


  assert(
    instruction.productId ===
      PRODUCT_ID,
    `Expected ${PRODUCT_ID}; received ${instruction.productId}`
  );


  assert(
    instruction.fundingCurrency ===
      "USD",
    `Expected USD funding; received ${instruction.fundingCurrency}`
  );


  assert(
    instruction.quoteSizeUsd ===
      EXPECTED_QUOTE_USD,
    `Expected $${EXPECTED_QUOTE_USD}; received $${instruction.quoteSizeUsd}`
  );


  console.log(
    "6. Controlled BTC instruction: PASS"
  );


  console.log(
    "\nREADINESS"
  );

  console.log(
    "---------"
  );

  console.log(
    "LIVE ARMED: TRUE"
  );

  console.log(
    "DRY RUN: FALSE"
  );

  console.log(
    "APPROVAL: APPROVED"
  );

  console.log(
    "AUTHORIZATION: AUTHORIZED"
  );

  console.log(
    "CONTROLLED PRODUCT: BTC-USD"
  );

  console.log(
    "CONTROLLED VALUE: $2.75"
  );

  console.log(
    "COINBASE ORDER SUBMITTED: NO"
  );


  console.log(
    "\nRESULT: PASS — CONTROLLED LIVE PROOF READY"
  );
}


main().catch(
  (
    error
  ) => {

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