/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Isolated State Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Read and write Multi-Asset cash-accounting state and
 * per-asset pending allocation state.
 *
 * SAFETY
 * - Multi-Asset only
 * - Per-client user_id isolation
 * - Does not access atlas_user_state
 * - Does not modify legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * - No Coinbase
 * - No execution
 * ============================================================
 */

import {
  createClient,
} from "@supabase/supabase-js";


type CashStateRow = {
  user_id: string;
  last_observed_cash_usd: number | string | null;
  accounted_cash_usd: number | string | null;
  last_processed_cash_usd: number | string | null;
  last_processed_at: string | null;
};


type PendingAllocationRow = {
  user_id: string;
  asset_symbol: string;
  pending_usd: number | string | null;
};


export type AtlasMultiAssetCashState = {
  userId: string;

  lastObservedCashUsd: number;

  accountedCashUsd: number;

  lastProcessedCashUsd: number;

  lastProcessedAt:
    | string
    | null;
};


export type AtlasMultiAssetPendingAllocation = {
  userId: string;

  assetSymbol: string;

  pendingUsd: number;
};


function money(
  value: number
): number {

  return Number(
    value.toFixed(8)
  );
}


function getSupabaseAdmin() {

  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";


  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";


  if (!url) {
    throw new Error(
      "atlas_multi_asset_supabase_url_missing"
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "atlas_multi_asset_service_role_missing"
    );
  }


  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}


export class SupabaseAtlasMultiAssetStateRepository {

  async loadCashState(
    userId: string
  ): Promise<
    AtlasMultiAssetCashState | null
  > {

    const normalizedUserId =
      userId.trim();


    if (!normalizedUserId) {
      throw new Error(
        "atlas_multi_asset_user_id_missing"
      );
    }


    const supabase =
      getSupabaseAdmin();


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "atlas_multi_asset_cash_state"
        )
        .select(
          [
            "user_id",
            "last_observed_cash_usd",
            "accounted_cash_usd",
            "last_processed_cash_usd",
            "last_processed_at",
          ].join(",")
        )
        .eq(
          "user_id",
          normalizedUserId
        )
        .maybeSingle();


    if (error) {
      throw new Error(
        `atlas_multi_asset_cash_state_lookup_failed:${error.message}`
      );
    }


    if (!data) {
      return null;
    }


    const row =
      data as unknown as CashStateRow;


    return {
      userId:
        String(
          row.user_id
        ),

      lastObservedCashUsd:
        Number(
          row.last_observed_cash_usd ??
          0
        ),

      accountedCashUsd:
        Number(
          row.accounted_cash_usd ??
          0
        ),

      lastProcessedCashUsd:
        Number(
          row.last_processed_cash_usd ??
          0
        ),

      lastProcessedAt:
        typeof row.last_processed_at ===
          "string"
          ? row.last_processed_at
          : null,
    };
  }


  async saveCashState(
    state: AtlasMultiAssetCashState
  ): Promise<void> {

    const normalizedUserId =
      state.userId.trim();


    if (!normalizedUserId) {
      throw new Error(
        "atlas_multi_asset_user_id_missing"
      );
    }


    if (
      !Number.isFinite(
        state.lastObservedCashUsd
      ) ||
      !Number.isFinite(
        state.accountedCashUsd
      ) ||
      !Number.isFinite(
        state.lastProcessedCashUsd
      ) ||
      state.lastObservedCashUsd < 0 ||
      state.accountedCashUsd < 0 ||
      state.lastProcessedCashUsd < 0
    ) {
      throw new Error(
        "atlas_multi_asset_cash_state_invalid"
      );
    }


    const supabase =
      getSupabaseAdmin();


    const {
      error,
    } =
      await supabase
        .from(
          "atlas_multi_asset_cash_state"
        )
        .upsert(
          {
            user_id:
              normalizedUserId,

            last_observed_cash_usd:
              money(
                state.lastObservedCashUsd
              ),

            accounted_cash_usd:
              money(
                state.accountedCashUsd
              ),

            last_processed_cash_usd:
              money(
                state.lastProcessedCashUsd
              ),

            last_processed_at:
              state.lastProcessedAt,

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "user_id",
          }
        );


    if (error) {
      throw new Error(
        `atlas_multi_asset_cash_state_save_failed:${error.message}`
      );
    }
  }


  async loadPendingAllocations(
    userId: string
  ): Promise<
    AtlasMultiAssetPendingAllocation[]
  > {

    const normalizedUserId =
      userId.trim();


    if (!normalizedUserId) {
      throw new Error(
        "atlas_multi_asset_user_id_missing"
      );
    }


    const supabase =
      getSupabaseAdmin();


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "atlas_multi_asset_pending_allocations"
        )
        .select(
          [
            "user_id",
            "asset_symbol",
            "pending_usd",
          ].join(",")
        )
        .eq(
          "user_id",
          normalizedUserId
        )
        .order(
          "asset_symbol",
          {
            ascending: true,
          }
        );


    if (error) {
      throw new Error(
        `atlas_multi_asset_pending_lookup_failed:${error.message}`
      );
    }


    const rows =
      (
        Array.isArray(data)
          ? data
          : []
      ) as unknown as PendingAllocationRow[];


    return rows.map(
      (row) => ({
        userId:
          String(
            row.user_id
          ),

        assetSymbol:
          String(
            row.asset_symbol
          )
            .trim()
            .toUpperCase(),

        pendingUsd:
          Number(
            row.pending_usd ??
            0
          ),
      })
    );
  }


  async setPendingAllocation(
    input: {
      userId: string;
      assetSymbol: string;
      pendingUsd: number;
    }
  ): Promise<void> {

    const normalizedUserId =
      input.userId.trim();


    const normalizedSymbol =
      input.assetSymbol
        .trim()
        .toUpperCase();


    if (
      !normalizedUserId ||
      !normalizedSymbol
    ) {
      throw new Error(
        "atlas_multi_asset_pending_identity_invalid"
      );
    }


    if (
      !Number.isFinite(
        input.pendingUsd
      ) ||
      input.pendingUsd < 0
    ) {
      throw new Error(
        "atlas_multi_asset_pending_amount_invalid"
      );
    }


    const supabase =
      getSupabaseAdmin();


    if (
      money(
        input.pendingUsd
      ) === 0
    ) {

      const {
        error,
      } =
        await supabase
          .from(
            "atlas_multi_asset_pending_allocations"
          )
          .delete()
          .eq(
            "user_id",
            normalizedUserId
          )
          .eq(
            "asset_symbol",
            normalizedSymbol
          );


      if (error) {
        throw new Error(
          `atlas_multi_asset_pending_delete_failed:${error.message}`
        );
      }


      return;
    }


    const {
      error,
    } =
      await supabase
        .from(
          "atlas_multi_asset_pending_allocations"
        )
        .upsert(
          {
            user_id:
              normalizedUserId,

            asset_symbol:
              normalizedSymbol,

            pending_usd:
              money(
                input.pendingUsd
              ),

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "user_id,asset_symbol",
          }
        );


    if (error) {
      throw new Error(
        `atlas_multi_asset_pending_save_failed:${error.message}`
      );
    }
  }
}