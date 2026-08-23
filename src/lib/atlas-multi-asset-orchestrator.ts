/**
 * ============================================================
 * YieldCraft Atlas
 * Multi-Asset Governance Orchestrator
 *
 * PURPOSE
 * Advance an Atlas multi-asset portfolio plan through the
 * existing governance boundaries.
 *
 * SAFETY
 * - Multi-asset only
 * - No Coinbase calls
 * - No order submission
 * - No credential access
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC execution
 *
 * Execution remains behind the existing hardened executor.
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
};


export async function governAtlasMultiAssetPlan(
  input: AtlasMultiAssetGovernanceInput
): Promise<AtlasMultiAssetGovernanceResult> {

  if (!input.userId.trim()) {
    throw new Error(
      "atlas_multi_asset_user_id_required"
    );
  }

  if (!input.portfolioPlanId.trim()) {
    throw new Error(
      "atlas_multi_asset_portfolio_plan_id_required"
    );
  }


  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const authorizationRepository =
    new SupabaseAtlasExecutionAuthorizationRepository();


  /*
   * Create the existing Atlas approval boundary.
   */
  const pendingApprovalResult =
    await createAtlasApproval(
      {
        userId: input.userId,
        portfolioPlanId:
          input.portfolioPlanId,
        reason:
          "Atlas multi-asset automated governance.",
      },
      approvalRepository
    );


  if (!pendingApprovalResult.valid) {
    throw new Error(
      `atlas_multi_asset_approval_creation_blocked:${pendingApprovalResult.reason}`
    );
  }


  const pendingApproval =
    pendingApprovalResult.approval;


  /*
   * Transition through the existing approval
   * state machine rather than bypassing it.
   */
  const approvedApproval =
    transitionAtlasApproval(
      pendingApproval,
      "APPROVED"
    );

  await approvalRepository.save(
    approvedApproval
  );


  const approvalGate =
    evaluateAtlasApprovalGate(
      approvedApproval
    );

  if (!approvalGate.approved) {
    throw new Error(
      `atlas_multi_asset_approval_blocked:${approvalGate.reason}`
    );
  }


  /*
   * Create authorization only from the
   * successfully approved Atlas approval.
   */
  const authorizationResult =
    await createExecutionAuthorizationFromApproval(
      approvedApproval,
      authorizationRepository
    );

  if (!authorizationResult.valid) {
    throw new Error(
      `atlas_multi_asset_authorization_creation_blocked:${authorizationResult.reason}`
    );
  }


  /*
   * Transition through the existing authorization
   * state machine rather than bypassing it.
   */
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

  if (!authorizationGate.authorized) {
    throw new Error(
      `atlas_multi_asset_authorization_blocked:${authorizationGate.reason}`
    );
  }


  return {
    approvalId:
      approvedApproval.approvalId,

    authorizationId:
      authorizedAuthorization.authorizationId,

    approved: true,
    authorized: true,
  };
}