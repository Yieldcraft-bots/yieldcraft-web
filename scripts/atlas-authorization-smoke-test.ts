/**
 * ============================================================
 * YieldCraft Atlas
 * Approval -> Execution Authorization Persistence Smoke Test
 *
 * ------------------------------------------------------------
 * PURPOSE
 * Prove the governance persistence chain:
 *
 * APPROVED approval
 * -> save
 * -> load
 * -> approval gate
 * -> create authorization
 * -> save
 * -> load
 * -> validate
 *
 * SAFETY
 * - Governance persistence only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 *
 * Test records are deleted in cleanup.
 * ============================================================
 */

import { config } from "dotenv";

import { supabaseAdmin } from "../src/lib/supabaseAdmin";

import { SupabaseAtlasApprovalRepository } from "../src/lib/repositories/atlasApprovalRepository";

import { SupabaseAtlasExecutionAuthorizationRepository } from "../src/lib/repositories/atlasExecutionAuthorizationRepository";

import { createExecutionAuthorizationFromApproval } from "../src/lib/atlas-operations/atlas-execution-authorization-orchestrator";

import { validateAtlasApproval } from "../src/lib/atlas-operations/atlas-approval-validator";

import { validateAtlasExecutionAuthorization } from "../src/lib/atlas-operations/atlas-execution-authorization-validator";

import type { AtlasApprovalContract } from "../src/lib/atlas-operations/atlas-approval-contract";

config({
  path: ".env.local",
});

async function main() {
  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();

  const approvalId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const portfolioPlanId = crypto.randomUUID();

  let authorizationId: string | null = null;
  let approvalSaved = false;

  const now = new Date().toISOString();

  const approval: AtlasApprovalContract = {
    approvalId,
    userId,
    portfolioPlanId,
    status: "APPROVED",
    approvedAt: now,
    createdAt: now,
    reason:
      "Atlas multi-asset authorization persistence smoke test.",
  };

  console.log("ATLAS_AUTHORIZATION_SMOKE_TEST");
  console.log("--------------------------------");

  try {
    const approvalValidation =
      validateAtlasApproval(approval);

    if (!approvalValidation.valid) {
      throw new Error(
        `Approval validation failed: ${approvalValidation.reason}`
      );
    }

    console.log("1. Approval validation: PASS");

    await approvalRepository.save(approval);
    approvalSaved = true;

    console.log("2. Approval save: PASS");

    const loadedApproval =
      await approvalRepository.load(
        approvalId,
        userId
      );

    if (!loadedApproval) {
      throw new Error(
        "Approval load failed: record not found."
      );
    }

    if (
      loadedApproval.approvalId !== approval.approvalId ||
      loadedApproval.userId !== approval.userId ||
      loadedApproval.portfolioPlanId !==
        approval.portfolioPlanId ||
      loadedApproval.status !== "APPROVED"
    ) {
      throw new Error(
        "Approval round-trip validation failed."
      );
    }

    console.log("3. Approval load: PASS");

    const result =
      await createExecutionAuthorizationFromApproval(
        loadedApproval,
        authorizationRepository
      );

    if (!result.valid) {
      throw new Error(
        `Authorization orchestration failed: ${result.reason}`
      );
    }

    authorizationId =
      result.authorization.authorizationId;

    console.log(
      "4. Approval -> authorization orchestration: PASS"
    );

    const loadedAuthorization =
      await authorizationRepository.load(
        authorizationId,
        userId
      );

    if (!loadedAuthorization) {
      throw new Error(
        "Authorization load failed: record not found."
      );
    }

    console.log("5. Authorization load: PASS");

    const authorizationValidation =
      validateAtlasExecutionAuthorization(
        loadedAuthorization
      );

    if (!authorizationValidation.valid) {
      throw new Error(
        `Loaded authorization validation failed: ${authorizationValidation.reason}`
      );
    }

    if (
      loadedAuthorization.approvalId !== approvalId ||
      loadedAuthorization.userId !== userId ||
      loadedAuthorization.portfolioPlanId !==
        portfolioPlanId ||
      loadedAuthorization.status !== "PENDING"
    ) {
      throw new Error(
        "Authorization round-trip validation failed."
      );
    }

    console.log(
      "6. Authorization validation: PASS"
    );

    console.log("--------------------------------");
    console.log(
      "RESULT: PASS — Atlas approval -> authorization persistence chain is healthy."
    );

  } finally {
    if (authorizationId || approvalSaved) {
      const supabase = supabaseAdmin();

      if (authorizationId) {
        const { error } =
          await supabase
            .from("atlas_execution_authorizations")
            .delete()
            .eq(
              "authorization_id",
              authorizationId
            );

        if (error) {
          console.error(
            "WARNING: authorization cleanup failed:",
            error.message
          );
        }
      }

      if (approvalSaved) {
        const { error: approvalCleanupError } =
          await supabase
            .from("atlas_approvals")
            .delete()
            .eq(
              "approval_id",
              approvalId
            );

        if (approvalCleanupError) {
          console.error(
            "WARNING: approval cleanup failed:",
            approvalCleanupError.message
          );
        } else {
          console.log("7. Test cleanup: PASS");
        }
      }
    }
  }
}

main().catch((error) => {
  console.error("--------------------------------");
  console.error("RESULT: FAIL");
  console.error(error);
  process.exitCode = 1;
});