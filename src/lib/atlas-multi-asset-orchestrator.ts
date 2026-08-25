/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Governance Orchestrator
 *
 * PURPOSE
 * Advance one deterministic Atlas Multi-Asset portfolio plan
 * through the existing governance boundaries.
 *
 * DEDUPE
 * - Same user + same deterministic portfolioPlanId reuses
 *   existing approved/authorized governance
 * - Does not create duplicate active approvals
 * - Does not create duplicate active authorizations
 * - Existing non-active governance fails closed
 *
 * SAFETY
 * - Multi-Asset only
 * - No Coinbase calls
 * - No order submission
 * - No credential access
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC execution
 *
 * Execution remains behind the hardened Multi-Asset executor.
 * ============================================================
 */

import {
  createAtlasApproval,
  transitionAtlasApproval,
  evaluateAtlasApprovalGate,
  createExecutionAuthorizationFromApproval,
  transitionAtlasExecutionAuthorization,
  evaluateAtlasExecutionAuthorizationGate,
} from "@/lib/atlas-operations";

import {
  SupabaseAtlasApprovalRepository,
} from "@/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "@/lib/repositories/atlasExecutionAuthorizationRepository";


export type AtlasMultiAssetGovernanceInput = {
  userId: string;
  portfolioPlanId: string;
};


export type AtlasMultiAssetGovernanceResult = {
  approvalId: string;
  authorizationId: string;
  approved: boolean;
  authorized: boolean;

  reused: boolean;
};


export async function governAtlasMultiAssetPlan(
  input: AtlasMultiAssetGovernanceInput
): Promise<AtlasMultiAssetGovernanceResult> {

  const userId =
    input.userId.trim();

  const portfolioPlanId =
    input.portfolioPlanId.trim();


  if (!userId) {
    throw new Error(
      "atlas_multi_asset_user_id_required"
    );
  }


  if (!portfolioPlanId) {
    throw new Error(
      "atlas_multi_asset_portfolio_plan_id_required"
    );
  }


  const approvalRepository =
    new SupabaseAtlasApprovalRepository();


  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();


  /*
   * ========================================================
   * 1. REUSE EXISTING AUTHORIZED GOVERNANCE
   * ========================================================
   *
   * This is the primary dedupe boundary.
   *
   * An unchanged deterministic plan must not receive a new
   * authorization every time the cron/governance route runs.
   */

  const existingAuthorization =
    await authorizationRepository
      .findByPortfolioPlan(
        portfolioPlanId,
        userId
      );


  if (existingAuthorization) {

    const existingAuthorizationGate =
      evaluateAtlasExecutionAuthorizationGate(
        existingAuthorization
      );


    if (
      existingAuthorizationGate.authorized
    ) {

      const existingApproval =
        await approvalRepository.load(
          existingAuthorization.approvalId,
          userId
        );


      if (!existingApproval) {
        throw new Error(
          "atlas_multi_asset_existing_authorization_approval_missing"
        );
      }


      const existingApprovalGate =
        evaluateAtlasApprovalGate(
          existingApproval
        );


      if (
        !existingApprovalGate.approved
      ) {
        throw new Error(
          `atlas_multi_asset_existing_approval_blocked:${existingApprovalGate.reason}`
        );
      }


      if (
        existingApproval.portfolioPlanId !==
        portfolioPlanId
      ) {
        throw new Error(
          "atlas_multi_asset_existing_governance_plan_mismatch"
        );
      }


      return {
        approvalId:
          existingApproval.approvalId,

        authorizationId:
          existingAuthorization.authorizationId,

        approved:
          true,

        authorized:
          true,

        reused:
          true,
      };
    }


    /*
     * Existing governance for this exact deterministic plan
     * exists but is no longer authorized.
     *
     * Fail closed rather than silently creating a replacement
     * authorization for identical pending state.
     */
    throw new Error(
      `atlas_multi_asset_existing_authorization_not_active:${existingAuthorization.status}`
    );
  }


  /*
   * ========================================================
   * 2. REUSE EXISTING APPROVAL IF PRESENT
   * ========================================================
   */

  const existingApproval =
    await approvalRepository
      .findByPortfolioPlan(
        portfolioPlanId,
        userId
      );


  let approvedApproval;


  if (existingApproval) {

    const approvalGate =
      evaluateAtlasApprovalGate(
        existingApproval
      );


    if (
      !approvalGate.approved
    ) {
      throw new Error(
        `atlas_multi_asset_existing_approval_not_active:${existingApproval.status}`
      );
    }


    approvedApproval =
      existingApproval;

  } else {

    /*
     * ======================================================
     * 3. CREATE APPROVAL
     * ======================================================
     */

    const pendingApprovalResult =
      await createAtlasApproval(
        {
          userId,

          portfolioPlanId,

          reason:
            "Atlas multi-asset automated governance.",
        },
        approvalRepository
      );


    if (
      !pendingApprovalResult.valid
    ) {
      throw new Error(
        `atlas_multi_asset_approval_creation_blocked:${pendingApprovalResult.reason}`
      );
    }


    approvedApproval =
      transitionAtlasApproval(
        pendingApprovalResult.approval,
        "APPROVED"
      );


    await approvalRepository.save(
      approvedApproval
    );


    const approvalGate =
      evaluateAtlasApprovalGate(
        approvedApproval
      );


    if (
      !approvalGate.approved
    ) {
      throw new Error(
        `atlas_multi_asset_approval_blocked:${approvalGate.reason}`
      );
    }
  }


  /*
   * ========================================================
   * 4. CREATE AUTHORIZATION
   * ========================================================
   *
   * We reach this point only when:
   *
   * - no authorization exists for this deterministic plan
   * - an approved approval exists for this plan
   */

  const authorizationResult =
    await createExecutionAuthorizationFromApproval(
      approvedApproval,
      authorizationRepository
    );


  if (
    !authorizationResult.valid
  ) {
    throw new Error(
      `atlas_multi_asset_authorization_creation_blocked:${authorizationResult.reason}`
    );
  }


  const authorizedAuthorization =
    transitionAtlasExecutionAuthorization(
      authorizationResult.authorization,
      "AUTHORIZED"
    );


  await authorizationRepository.save(
    authorizedAuthorization
  );


  const authorizationGate =
    evaluateAtlasExecutionAuthorizationGate(
      authorizedAuthorization
    );


  if (
    !authorizationGate.authorized
  ) {
    throw new Error(
      `atlas_multi_asset_authorization_blocked:${authorizationGate.reason}`
    );
  }


  return {
    approvalId:
      approvedApproval.approvalId,

    authorizationId:
      authorizedAuthorization.authorizationId,

    approved:
      true,

    authorized:
      true,

    reused:
      false,
  };
}