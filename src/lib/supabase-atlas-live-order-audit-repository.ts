/**
 * ============================================================
 * YieldCraft Atlas
 * Supabase Live Order Audit Repository
 *
 * PURPOSE
 * Supabase implementation for Atlas live audit persistence,
 * atomic execution reservations, submission finalization,
 * and post-submission settlement reconciliation.
 *
 * SAFETY
 * - No execution logic
 * - No Coinbase calls
 * - No order decisions
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only persists, reserves, finalizes,
 * reconciles, and retrieves audit records.
 * ============================================================
 */

import type {
  AtlasLiveExecutionFinalizeInput,
  AtlasLiveExecutionReservationInput,
  AtlasLiveExecutionReservationResult,
  AtlasLiveExecutionSettlementInput,
  AtlasLiveOrderAuditRepository,
  AtlasLiveSubmittedExecution,
} from "./atlas-live-order-audit-repository";

import type {
  AtlasLiveOrderAudit,
} from "./atlas-live-order-audit";

import {
  createClient,
} from "@supabase/supabase-js";


function getSupabase() {

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }


  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}


export class SupabaseAtlasLiveOrderAuditRepository
  implements AtlasLiveOrderAuditRepository {


  async create(
    audit: AtlasLiveOrderAudit
  ): Promise<void> {

    const supabase =
      getSupabase();


    const {
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .insert({
        created_at:
          audit.createdAt,

        status:
          audit.status,

        user_id:
          audit.userId,

        authorization_id:
          audit.authorizationId,

        portfolio_plan_id:
          audit.portfolioPlanId,

        product_id:
          audit.productId,

        quote_size_usd:
          audit.quoteSizeUsd,

        coinbase_order_id:
          audit.coinbaseOrderId,

        response_summary:
          audit.responseSummary,
      });


    if (error) {
      throw error;
    }
  }


  async listByUser(
    userId: string
  ): Promise<AtlasLiveOrderAudit[]> {

    const supabase =
      getSupabase();


    const {
      data,
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


    if (error) {
      throw error;
    }


    return (data ?? []).map(
      (row) => ({
        createdAt:
          row.created_at,

        status:
          row.status,

        userId:
          row.user_id,

        authorizationId:
          row.authorization_id,

        portfolioPlanId:
          row.portfolio_plan_id,

        productId:
          row.product_id,

        quoteSizeUsd:
          Number(
            row.quote_size_usd
          ),

        coinbaseOrderId:
          row.coinbase_order_id,

        responseSummary:
          row.response_summary,
      })
    );
  }


  async reserveExecution(
    input: AtlasLiveExecutionReservationInput
  ): Promise<AtlasLiveExecutionReservationResult> {

    const supabase =
      getSupabase();


    const {
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .insert({
        created_at:
          new Date().toISOString(),

        status:
          "RESERVED",

        user_id:
          input.userId,

        authorization_id:
          input.authorizationId,

        portfolio_plan_id:
          input.portfolioPlanId,

        product_id:
          input.productId,

        quote_size_usd:
          Number(
            input.quoteSizeUsd.toFixed(2)
          ),

        coinbase_order_id:
          null,

        response_summary:
          "execution_reserved",

        execution_key:
          input.executionKey,
      });


    if (!error) {
      return {
        reserved: true,
        reason: "reserved",
      };
    }


    if (error.code === "23505") {
      return {
        reserved: false,
        reason: "already_reserved",
      };
    }


    throw error;
  }


  async finalizeExecution(
    input: AtlasLiveExecutionFinalizeInput
  ): Promise<void> {

    const supabase =
      getSupabase();


    const {
      data,
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .update({
        status:
          input.status,

        coinbase_order_id:
          input.coinbaseOrderId,

        response_summary:
          input.responseSummary,
      })
      .eq(
        "execution_key",
        input.executionKey
      )
      .eq(
        "status",
        "RESERVED"
      )
      .select("id");


    if (error) {
      throw error;
    }


    if (!data || data.length !== 1) {
      throw new Error(
        "Atlas execution reservation could not be finalized."
      );
    }
  }


  async loadSubmittedExecution(
    executionKey: string
  ): Promise<AtlasLiveSubmittedExecution | null> {

    const normalizedExecutionKey =
      executionKey.trim();


    if (!normalizedExecutionKey) {
      throw new Error(
        "atlas_live_execution_key_missing"
      );
    }


    const supabase =
      getSupabase();


    const {
      data,
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .select(
        "created_at,user_id,authorization_id,portfolio_plan_id,product_id,quote_size_usd,coinbase_order_id,response_summary,execution_key"
      )
      .eq(
        "execution_key",
        normalizedExecutionKey
      )
      .eq(
        "status",
        "SUBMITTED"
      )
      .maybeSingle();


    if (error) {
      throw error;
    }


    if (!data) {
      return null;
    }


    if (
      typeof data.coinbase_order_id !==
        "string" ||
      !data.coinbase_order_id.trim()
    ) {
      throw new Error(
        "atlas_live_submitted_execution_order_id_missing"
      );
    }


    return {
      executionKey:
        data.execution_key,

      userId:
        data.user_id,

      authorizationId:
        data.authorization_id,

      portfolioPlanId:
        data.portfolio_plan_id,

      productId:
        data.product_id,

      quoteSizeUsd:
        Number(
          data.quote_size_usd
        ),

      coinbaseOrderId:
        data.coinbase_order_id,

      responseSummary:
        data.response_summary,

      createdAt:
        data.created_at,
    };
  }


  async settleSubmittedExecution(
    input: AtlasLiveExecutionSettlementInput
  ): Promise<void> {

    const supabase =
      getSupabase();


    const {
      data,
      error,
    } = await supabase
      .from("atlas_live_execution_logs")
      .update({
        status:
          "SETTLED",

        coinbase_order_id:
          input.coinbaseOrderId,

        response_summary:
          input.responseSummary,
      })
      .eq(
        "execution_key",
        input.executionKey
      )
      .eq(
        "status",
        "SUBMITTED"
      )
      .eq(
        "coinbase_order_id",
        input.coinbaseOrderId
      )
      .select("id");


    if (error) {
      throw error;
    }


    if (!data || data.length !== 1) {
      throw new Error(
        "Atlas submitted execution could not be settled."
      );
    }
  }
}