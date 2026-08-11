/**
 * ============================================================
 * YieldCraft Atlas
 * Full Portfolio Flow Smoke Test
 *
 * Client Plan
 * -> Approval
 * -> Authorization
 * -> Persisted Plan Load
 * -> Shadow Boundary
 *
 * No Coinbase
 * No Pulse
 * No Recon
 * No live execution
 * ============================================================
 */

import { config } from "dotenv";

import {
  saveAtlasPortfolioPlan,
  loadAtlasPortfolioPlan,
} from "../src/lib/repositories/atlasPortfolioPlanRepository";

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

import type {
  PortfolioExecutionPlan,
} from "../src/lib/portfolio-execution-planner";

config({
  path: ".env.local",
});

async function main() {
  console.log("ATLAS_FULL_FLOW_SMOKE_TEST");
  console.log("----------------------------");

  const supabase =
    (await import("../src/lib/supabaseAdmin"))
      .supabaseAdmin();

  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();

  const userId = crypto.randomUUID();
  const portfolioPlanId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();

  let authorizationId: string | null = null;

  const plan: PortfolioExecutionPlan = {
    valid: true,
    reason: "plan_ready",
    deployableUsd: 100,
    allocationTotalPercent: 100,
    plannedUsd: 100,
    unplannedUsd: 0,
    orders: [
      {
        symbol: "BTC",
        targetPercent: 100,
        proposedBuyUsd: 100,
        brokerId: "coinbase",
        productId: "BTC-USD",
        executable: true,
        reason: "ready",
      },
    ],
  };

  try {
    await saveAtlasPortfolioPlan({
      portfolioPlanId,
      userId,
      plan,
    });

    console.log(
      "1. Portfolio plan save: PASS"
    );

    const stored =
      await loadAtlasPortfolioPlan(
        portfolioPlanId
      );

    if (!stored) {
      throw new Error(
        "portfolio plan missing"
      );
    }

    console.log(
      "2. Portfolio plan load: PASS"
    );

    const approval: AtlasApprovalContract = {
      approvalId,
      userId,
      portfolioPlanId,
      status: "APPROVED",
      approvedAt:
        new Date().toISOString(),
      createdAt:
        new Date().toISOString(),
      reason:
        "Full Atlas flow test",
    };

    await approvalRepository.save(
      approval
    );

    console.log(
      "3. Approval save: PASS"
    );

    const authorization =
      await createExecutionAuthorizationFromApproval(
        approval,
        authorizationRepository
      );

    if (!authorization.valid) {
      throw new Error(
        authorization.reason
      );
    }

    authorizationId =
      authorization.authorization.authorizationId;

    const authorized =
      transitionAtlasExecutionAuthorization(
        authorization.authorization,
        "AUTHORIZED"
      );

    await authorizationRepository.save(
      authorized
    );

    console.log(
      "4. Authorization: PASS"
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
      "5. Execution gate: PASS"
    );

    console.log(
      "RESULT: PASS — Full Atlas persisted flow ready."
    );

  } finally {

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
      .from("atlas_approvals")
      .delete()
      .eq(
        "approval_id",
        approvalId
      );

    await supabase
      .from("atlas_portfolio_plans")
      .delete()
      .eq(
        "portfolio_plan_id",
        portfolioPlanId
      );

    console.log(
      "6. Cleanup: PASS"
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