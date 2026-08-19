/**
 * Atlas Approval Decision Smoke Test
 *
 * Safety:
 * - Governance only
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 */

import { config } from "dotenv";

config({
  path: ".env.local",
});

const token =
  process.env.ATLAS_APPROVAL_OPERATOR_TOKEN ?? "";

if (!token) {
  throw new Error(
    "Missing ATLAS_APPROVAL_OPERATOR_TOKEN"
  );
}

async function main() {
  const response =
    await fetch(
      "http://localhost:3000/api/operator/atlas-approval-decision",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-atlas-operator-token": token,
        },
        body: JSON.stringify({
          approvalId:
            "cb33b725-0ba0-4df7-bdf9-7c8a91951a1e",
          userId:
            "295165f4-df46-403f-8727-80408d6a2578",
          nextStatus:
            "APPROVED",
        }),
      }
    );

  console.log(
    "STATUS:",
    response.status
  );

  console.log(
    JSON.stringify(
      await response.json(),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});