/**
 * ============================================================
 * YieldCraft Atlas
 * Live Audit Persistence Test
 *
 * PURPOSE
 * Verify Atlas live audit records persist correctly.
 *
 * TESTS
 * - Create audit object
 * - Persist through repository
 *
 * SAFETY
 * - No Coinbase
 * - No execution
 * - No Pulse
 * - No Recon
 * - No UI
 * ============================================================
 */


import { config } from "dotenv";


config({
  path: ".env.local",
});


import {
  createAtlasLiveOrderAudit,
} from "../src/lib/atlas-live-order-audit";


import {
  SupabaseAtlasLiveOrderAuditRepository,
} from "../src/lib/supabase-atlas-live-order-audit-repository";



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
    "ATLAS LIVE AUDIT PERSISTENCE TEST"
  );

  console.log(
    "---------------------------------"
  );



  const audit =
    createAtlasLiveOrderAudit({
      status: "BLOCKED",

      userId:
        "00000000-0000-0000-0000-000000000001",

      authorizationId:
        "00000000-0000-0000-0000-000000000002",

      portfolioPlanId:
        "00000000-0000-0000-0000-000000000003",

      productId:
        "BTC-USD",

      quoteSizeUsd:
        10,

      coinbaseOrderId:
        null,

      responseSummary:
        "audit_persistence_test",
    });



  assert(
    audit.status === "BLOCKED",
    "Audit object creation failed."
  );



  const repository =
    new SupabaseAtlasLiveOrderAuditRepository();



  await repository.create(
    audit
  );



  console.log(
    "1. Audit object creation: PASS"
  );


  console.log(
    "2. Audit persistence write: PASS"
  );


  console.log(
    "RESULT: PASS — Atlas audit persistence healthy."
  );
}



main().catch((error) => {

  console.error(
    "RESULT: FAIL"
  );

  console.error(error);

  process.exitCode = 1;

});