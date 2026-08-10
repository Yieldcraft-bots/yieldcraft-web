/**
 * ============================================================
 * YieldCraft Atlas
 * Atlas Execution Authorization Repository Adapter
 * ------------------------------------------------------------
 * PURPOSE
 * Persist and load execution authorization contracts.
 *
 * SAFETY
 * - Database persistence only
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse imports
 * - No Recon imports
 *
 * This file implements the persistence boundary.
 * It does not authorize or submit orders.
 * ============================================================
 */

import {
  supabaseAdmin,
} from "../supabaseAdmin";

import type {
  AtlasExecutionAuthorizationRepository,
} from "../atlas-operations/atlas-execution-authorization-repository";

import type {
  AtlasExecutionAuthorizationContract,
} from "../atlas-operations/atlas-execution-authorization-contract";


export class SupabaseAtlasExecutionAuthorizationRepository
implements AtlasExecutionAuthorizationRepository
{
  async save(
    authorization: AtlasExecutionAuthorizationContract
  ): Promise<void> {
    const supabase = supabaseAdmin();

    const { data: existing, error: lookupError } =
      await supabase
        .from("atlas_execution_authorizations")
        .select("id")
        .eq(
          "authorization_id",
          authorization.authorizationId
        )
        .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    const payload = {
      authorization_id:
        authorization.authorizationId,

      approval_id:
        authorization.approvalId,

      user_id:
        authorization.userId,

      portfolio_plan_id:
        authorization.portfolioPlanId,

      status:
        authorization.status,

      authorized_at:
        authorization.authorizedAt,

      reason:
        authorization.reason,

      created_at:
        authorization.createdAt,
    };

    if (existing?.id) {
      const { error } =
        await supabase
          .from("atlas_execution_authorizations")
          .update(payload)
          .eq(
            "id",
            existing.id
          );

      if (error) {
        throw error;
      }

      return;
    }

    const { error } =
      await supabase
        .from("atlas_execution_authorizations")
        .insert(payload);

    if (error) {
      throw error;
    }
  }

  async load(
    authorizationId: string
  ): Promise<AtlasExecutionAuthorizationContract | null> {
    const supabase = supabaseAdmin();

    const { data, error } =
      await supabase
        .from("atlas_execution_authorizations")
        .select("*")
        .eq(
          "authorization_id",
          authorizationId
        )
        .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }

      throw error;
    }

    return {
      authorizationId:
        data.authorization_id,

      approvalId:
        data.approval_id,

      userId:
        data.user_id,

      portfolioPlanId:
        data.portfolio_plan_id,

      status:
        data.status,

      authorizedAt:
        data.authorized_at,

      createdAt:
        data.created_at,

      reason:
        data.reason,
    };
  }
}