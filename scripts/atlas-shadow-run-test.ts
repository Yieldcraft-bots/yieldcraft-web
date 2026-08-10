/**
 * ============================================================
 * YieldCraft Atlas
 * Protected Shadow Run Test
 * ------------------------------------------------------------
 * PURPOSE
 * Verify:
 *
 * APPROVED approval
 * -> AUTHORIZED execution authorization
 * -> execution gate
 * -> shadow execution only
 *
 * SAFETY
 * - Test only
 * - No live execution
 * - No Coinbase submission
 * - Cleanup after test
 * ============================================================
 */

import { config } from "dotenv";

import {
  SupabaseAtlasApprovalRepository,
} from "../src/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "../src/lib/repositories/atlasExecutionAuthorizationRepository";

import {
  createExecutionAuthorizationFromApproval,
  transitionAtlasExecutionAuthorization,
  evaluateAtlasExecutionAuthorizationGate,
} from "../src/lib/atlas-operations";

import type {
  AtlasApprovalContract,
} from "../src/lib/atlas-operations";

config({
  path: ".env.local",
});

async function main() {
  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();

  const approvalId =
    crypto.randomUUID();

  const userId =
    crypto.randomUUID();

  const portfolioPlanId =
    crypto.randomUUID();

  let authorizationId: string | null = null;

  const now =
    new Date().toISOString();

  const approval: AtlasApprovalContract = {
    approvalId,
    userId,
    portfolioPlanId,
    status: "APPROVED",
    approvedAt: now,
    createdAt: now,
    reason:
      "Atlas protected shadow execution test.",
  };

  try {
    console.log(
      "ATLAS_SHADOW_RUN_TEST"
    );
    console.log(
      "----------------------------"
    );

    await approvalRepository.save(
      approval
    );

    console.log(
      "1. Approved approval save: PASS"
    );

    const result =
      await createExecutionAuthorizationFromApproval(
        approval,
        authorizationRepository
      );

    if (!result.valid) {
      throw new Error(
        result.reason
      );
    }

    authorizationId =
      result.authorization.authorizationId;

    console.log(
      "2. Authorization creation: PASS"
    );

    const loadedAuthorization =
      await authorizationRepository.load(
        authorizationId
      );

    if (!loadedAuthorization) {
      throw new Error(
        "Authorization reload failed."
      );
    }

    const authorized =
      transitionAtlasExecutionAuthorization(
        loadedAuthorization,
        "AUTHORIZED"
      );

    await authorizationRepository.save(
      authorized
    );

    console.log(
      "3. Authorization transition: PASS"
    );

    const gate =
      evaluateAtlasExecutionAuthorizationGate(
        authorized
      );

    if (!gate.authorized) {
      throw new Error(
        gate.reason
      );
    }

    console.log(
      "4. Authorization gate: PASS"
    );

    console.log(
      "RESULT: PASS — Protected shadow execution boundary ready."
    );

  } finally {
    const supabase =
      (await import(
        "../src/lib/supabaseAdmin"
      )).supabaseAdmin();

    if (authorizationId) {
      await supabase
        .from(
          "atlas_execution_authorizations"
        )
        .delete()
        .eq(
          "authorization_id",
          authorizationId
        );
    }

    await supabase
      .from(
        "atlas_approvals"
      )
      .delete()
      .eq(
        "approval_id",
        approvalId
      );

    console.log(
      "5. Cleanup: PASS"
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