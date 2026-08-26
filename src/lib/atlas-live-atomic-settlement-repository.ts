/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Atomic Live Settlement Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Call the database transaction that atomically:
 *
 * - claims one SUBMITTED live execution
 * - verifies Coinbase order identity
 * - consumes authoritative filled USD
 * - marks the execution SETTLED
 *
 * SAFETY
 * - No Coinbase calls
 * - No order submission
 * - No execution decisions
 * - No approval mutation
 * - No authorization mutation
 * - No portfolio-plan mutation
 * - Multi-Asset only
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  createClient,
} from "@supabase/supabase-js";


export type AtlasAtomicSettlementResult = {
  settled: boolean;

  userId:
    string | null;

  previousPendingUsd:
    number;

  remainingPendingUsd:
    number;
};


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
      "atlas_atomic_settlement_supabase_url_missing"
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "atlas_atomic_settlement_service_role_missing"
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


export async function settleAtlasLiveExecutionAtomically(
  input: {
    executionKey: string;
    coinbaseOrderId: string;
    expectedProductId: string;
    assetSymbol: string;
    filledValueUsd: number;
  }
): Promise<AtlasAtomicSettlementResult> {

  const executionKey =
    input.executionKey.trim();

  const coinbaseOrderId =
    input.coinbaseOrderId.trim();

  const expectedProductId =
    input.expectedProductId.trim();

  const assetSymbol =
    input.assetSymbol
      .trim()
      .toUpperCase();


  if (!executionKey) {
    throw new Error(
      "atlas_atomic_settlement_execution_key_missing"
    );
  }


  if (!coinbaseOrderId) {
    throw new Error(
      "atlas_atomic_settlement_coinbase_order_id_missing"
    );
  }


  if (!expectedProductId) {
    throw new Error(
      "atlas_atomic_settlement_product_id_missing"
    );
  }


  if (!assetSymbol) {
    throw new Error(
      "atlas_atomic_settlement_asset_symbol_missing"
    );
  }


  if (
    !Number.isFinite(
      input.filledValueUsd
    ) ||
    input.filledValueUsd <= 0
  ) {
    throw new Error(
      "atlas_atomic_settlement_filled_value_invalid"
    );
  }


  const supabase =
    getSupabaseAdmin();


  const {
    data,
    error,
  } = await supabase.rpc(
    "settle_atlas_live_execution_and_consume_pending",
    {
      p_execution_key:
        executionKey,

      p_coinbase_order_id:
        coinbaseOrderId,

      p_expected_product_id:
        expectedProductId,

      p_asset_symbol:
        assetSymbol,

      p_filled_value_usd:
        Number(
          input.filledValueUsd.toFixed(8)
        ),
    }
  );


  if (error) {
    throw new Error(
      `atlas_atomic_settlement_failed:${error.message}`
    );
  }


  const rows =
    (
      Array.isArray(data)
        ? data
        : []
    ) as unknown as Array<{
      settled:
        boolean;

      user_id:
        string | null;

      previous_pending_usd:
        number | string | null;

      remaining_pending_usd:
        number | string | null;
    }>;


  const row =
    rows[0];


  if (!row) {
    throw new Error(
      "atlas_atomic_settlement_result_missing"
    );
  }


  return {
    settled:
      row.settled === true,

    userId:
      typeof row.user_id ===
        "string"
        ? row.user_id
        : null,

    previousPendingUsd:
      Number(
        row.previous_pending_usd ??
        0
      ),

    remainingPendingUsd:
      Number(
        row.remaining_pending_usd ??
        0
      ),
  };
}