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


const TABLE =
  "atlas_execution_authorizations";


function mapAuthorization(
  data: any
): AtlasExecutionAuthorizationContract {

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


export class SupabaseAtlasExecutionAuthorizationRepository
implements AtlasExecutionAuthorizationRepository
{

  async save(
    authorization: AtlasExecutionAuthorizationContract
  ): Promise<void> {

    const supabase =
      supabaseAdmin();


    const {
      data: existing,
      error: lookupError,
    } =
      await supabase
        .from(
          TABLE
        )
        .select(
          "id"
        )
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

      const {
        error,
      } =
        await supabase
          .from(
            TABLE
          )
          .update(
            payload
          )
          .eq(
            "id",
            existing.id
          );


      if (error) {
        throw error;
      }


      return;
    }


    const {
      error,
    } =
      await supabase
        .from(
          TABLE
        )
        .insert(
          payload
        );


    if (error) {
      throw error;
    }
  }


  async load(
    authorizationId: string,
    userId: string
  ): Promise<AtlasExecutionAuthorizationContract | null> {

    const supabase =
      supabaseAdmin();


    const {
      data,
      error,
    } =
      await supabase
        .from(
          TABLE
        )
        .select(
          "*"
        )
        .eq(
          "authorization_id",
          authorizationId
        )
        .eq(
          "user_id",
          userId
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {
      return null;
    }


    return mapAuthorization(
      data
    );
  }


  /**
   * Find existing authorization for one deterministic
   * Multi-Asset portfolio plan.
   *
   * READ ONLY.
   *
   * This lets the Multi-Asset governance orchestrator reuse
   * the existing active authorization instead of creating a
   * duplicate every scheduler cycle.
   *
   * Historical duplicates may exist from before deterministic
   * governance dedupe, so the newest matching row wins.
   */
  async findByPortfolioPlan(
    portfolioPlanId: string,
    userId: string
  ): Promise<AtlasExecutionAuthorizationContract | null> {

    const normalizedPlanId =
      portfolioPlanId.trim();


    const normalizedUserId =
      userId.trim();


    if (
      !normalizedPlanId ||
      !normalizedUserId
    ) {
      return null;
    }


    const supabase =
      supabaseAdmin();


    const {
      data,
      error,
    } =
      await supabase
        .from(
          TABLE
        )
        .select(
          "*"
        )
        .eq(
          "portfolio_plan_id",
          normalizedPlanId
        )
        .eq(
          "user_id",
          normalizedUserId
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {
      return null;
    }


    return mapAuthorization(
      data
    );
  }
}