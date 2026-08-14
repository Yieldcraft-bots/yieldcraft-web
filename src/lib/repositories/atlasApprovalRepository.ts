/**
 * ============================================================
 * YieldCraft Atlas
 * Atlas Approval Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Persist and load Atlas approval contracts.
 *
 * SAFETY
 * - Database persistence only
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse imports
 * - No Recon imports
 *
 * This file implements the approval persistence boundary.
 * It does not decide approvals.
 * ============================================================
 */

import { supabaseAdmin } from "../supabaseAdmin";

import type {
  AtlasApprovalContract,
} from "../atlas-operations";

import type {
  AtlasApprovalRepository,
} from "../atlas-operations";


const TABLE = "atlas_approvals";


export class SupabaseAtlasApprovalRepository
  implements AtlasApprovalRepository
{
  async load(
    approvalId: string,
    userId: string
  ): Promise<AtlasApprovalContract | null> {
    const supabase = supabaseAdmin();


    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("approval_id", approvalId)
      .eq("user_id", userId)
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {
      return null;
    }


    return {
      approvalId: data.approval_id,
      userId: data.user_id,
      portfolioPlanId: data.portfolio_plan_id,
      status: data.status,
      approvedAt: data.approved_at,
      createdAt: data.created_at,
      reason: data.reason,
    };
  }


  async save(
    approval: AtlasApprovalContract
  ): Promise<void> {
    const supabase = supabaseAdmin();


    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          approval_id: approval.approvalId,
          user_id: approval.userId,
          portfolio_plan_id:
            approval.portfolioPlanId,
          status: approval.status,
          approved_at:
            approval.approvedAt,
          reason: approval.reason,
          created_at:
            approval.createdAt,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "approval_id",
        }
      );


    if (error) {
      throw error;
    }
  }
}