/**
 * ============================================================
 * YieldCraft Atlas
 * Multi-Asset Governance Orchestrator Smoke Test
 *
 * PURPOSE
 * Prove the isolated multi-asset governance orchestrator:
 *
 * Portfolio Plan
 * -> APPROVED
 * -> AUTHORIZED
 *
 * SAFETY
 * - No Coinbase
 * - No order submission
 * - No Pulse
 * - No Recon
 * - No Atlas BTC changes
 * - Cleans up test records
 * ============================================================
 */

import { config } from "dotenv";

import {
  saveAtlasPortfolioPlan,
} from "../src/lib/repositories/atlasPortfolioPlanRepository";

import {
  governAtlasMultiAssetPlan,
} from "../src/lib/atlas-multi-asset-orchestrator";

import {
  SupabaseAtlasApprovalRepository,
} from "../src/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "../src/lib/repositories/atlasExecutionAuthorizationRepository";

import type {
  PortfolioExecutionPlan,
} from "../src/lib/portfolio-execution-planner";


config({
  path: ".env.local",
});


async function main() {

  console.log(
    "ATLAS_MULTI_ASSET_GOVERNANCE_ORCHESTRATOR_SMOKE_TEST"
  );

  console.log(
    "-----------------------------------------------------"
  );


  const supabase =
    (await import(
      "../src/lib/supabaseAdmin"
    )).supabaseAdmin();


  const userId =
    crypto.randomUUID();

  const portfolioPlanId =
    crypto.randomUUID();


  let approvalId:
    string | null = null;

  let authorizationId:
    string | null = null;


  const plan:
    PortfolioExecutionPlan = {

    valid: true,

    reason:
      "plan_ready",

    deployableUsd:
      20,

    allocationTotalPercent:
      100,

    plannedUsd:
      20,

    unplannedUsd:
      0,

    orders: [
      {
        symbol:
          "AAPL",

        targetPercent:
          100,

        proposedBuyUsd:
          20,

        brokerId:
          "coinbase",

        productId:
          "ec78ee42e2d0c969366fc2540fd2f49f0e8d2b8a8ad258417a814287eb8a2994",

        executable:
          true,

        reason:
          "ready",
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
      "1. Portfolio plan persisted: PASS"
    );


    const governed =
      await governAtlasMultiAssetPlan({
        userId,
        portfolioPlanId,
      });


    approvalId =
      governed.approvalId;

    authorizationId =
      governed.authorizationId;


    console.log(
      "2. Governance orchestrator returned: PASS"
    );


    const approvalRepository =
      new SupabaseAtlasApprovalRepository();

    const authorizationRepository =
      new SupabaseAtlasExecutionAuthorizationRepository();


    const approval =
      await approvalRepository.load(
        approvalId,
        userId
      );


    if (
      !approval ||
      approval.status !== "APPROVED"
    ) {
      throw new Error(
        "APPROVAL_NOT_APPROVED"
      );
    }


    console.log(
      "3. Approval status APPROVED: PASS"
    );


    const authorization =
      await authorizationRepository.load(
        authorizationId,
        userId
      );


    if (
      !authorization ||
      authorization.status !==
        "AUTHORIZED"
    ) {
      throw new Error(
        "AUTHORIZATION_NOT_AUTHORIZED"
      );
    }


    console.log(
      "4. Authorization status AUTHORIZED: PASS"
    );


    if (
      authorization.approvalId !==
      approval.approvalId
    ) {
      throw new Error(
        "AUTHORIZATION_APPROVAL_MISMATCH"
      );
    }


    if (
      authorization.portfolioPlanId !==
      approval.portfolioPlanId
    ) {
      throw new Error(
        "AUTHORIZATION_PLAN_MISMATCH"
      );
    }


    console.log(
      "5. Governance bindings: PASS"
    );


    console.log(
      "RESULT: PASS — isolated multi-asset governance orchestrator proven."
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


    if (approvalId) {

      await supabase
        .from(
          "atlas_approvals"
        )
        .delete()
        .eq(
          "approval_id",
          approvalId
        );
    }


    await supabase
      .from(
        "atlas_portfolio_plans"
      )
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


main().catch(
  (error) => {

    console.error(
      "RESULT: FAIL"
    );

    console.error(
      error
    );

    process.exitCode =
      1;
  }
);