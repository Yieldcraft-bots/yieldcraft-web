/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Eligible Client Roster
 * ------------------------------------------------------------
 * PURPOSE
 * Determine which clients are eligible to enter the isolated
 * Atlas Multi-Asset governance cycle.
 *
 * ELIGIBILITY
 * - Atlas entitlement required
 * - Active subscription required
 * - Atlas-scoped Coinbase credentials required
 * - Enabled client allocation required
 * - Allocation must total 100%
 *
 * SAFETY
 * - READ ONLY
 * - Multi-Asset only
 * - No atlas_user_state
 * - No legacy Atlas BTC
 * - No Coinbase calls
 * - No order submission
 * - No approval mutation
 * - No authorization mutation
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  supabaseAdmin,
} from "./supabaseAdmin";


type EntitlementRow = {
  user_id: string;
  atlas: boolean | null;
};


type SubscriptionRow = {
  user_id: string;
  plan: string | null;
  status: string | null;
};


type CoinbaseKeyRow = {
  user_id: string;
  product_scope: string | null;
};


type AllocationRow = {
  user_id: string;
  asset_symbol: string;
  target_percent: number | string | null;
  enabled: boolean | null;
};


export type AtlasMultiAssetRosterClient = {
  userId: string;

  eligible: boolean;

  reason:
    | "eligible"
    | "atlas_not_entitled"
    | "subscription_not_active"
    | "atlas_coinbase_key_missing"
    | "allocation_missing"
    | "allocation_total_not_100";

  atlasEntitled: boolean;

  subscriptionActive: boolean;

  atlasKeyConnected: boolean;

  allocationCount: number;

  allocationTotalPercent: number;
};


export type AtlasMultiAssetRosterResult = {
  eligibleUserIds: string[];

  clients: AtlasMultiAssetRosterClient[];

  summary: {
    considered: number;
    eligible: number;
    blocked: number;
  };
};


function percent(
  value: number
): number {

  return Number(
    value.toFixed(8)
  );
}


export async function loadAtlasMultiAssetClientRoster():
Promise<AtlasMultiAssetRosterResult> {

  const supabase =
    supabaseAdmin();


  const [
    entitlementResult,
    subscriptionResult,
    keyResult,
    allocationResult,
  ] =
    await Promise.all([

      supabase
        .from("entitlements")
        .select(
          "user_id, atlas"
        ),

      supabase
        .from("subscriptions")
        .select(
          "user_id, plan, status"
        ),

      supabase
        .from("coinbase_keys")
        .select(
          "user_id, product_scope"
        )
        .eq(
          "product_scope",
          "atlas"
        ),

      supabase
        .from(
          "client_allocation_plans"
        )
        .select(
          [
            "user_id",
            "asset_symbol",
            "target_percent",
            "enabled",
          ].join(",")
        )
        .eq(
          "enabled",
          true
        ),
    ]);


  if (entitlementResult.error) {
    throw new Error(
      `atlas_multi_asset_roster_entitlements_failed:${entitlementResult.error.message}`
    );
  }


  if (subscriptionResult.error) {
    throw new Error(
      `atlas_multi_asset_roster_subscriptions_failed:${subscriptionResult.error.message}`
    );
  }


  if (keyResult.error) {
    throw new Error(
      `atlas_multi_asset_roster_keys_failed:${keyResult.error.message}`
    );
  }


  if (allocationResult.error) {
    throw new Error(
      `atlas_multi_asset_roster_allocations_failed:${allocationResult.error.message}`
    );
  }


  const entitlementRows =
    (
      Array.isArray(
        entitlementResult.data
      )
        ? entitlementResult.data
        : []
    ) as unknown as EntitlementRow[];


  const subscriptionRows =
    (
      Array.isArray(
        subscriptionResult.data
      )
        ? subscriptionResult.data
        : []
    ) as unknown as SubscriptionRow[];


  const keyRows =
    (
      Array.isArray(
        keyResult.data
      )
        ? keyResult.data
        : []
    ) as unknown as CoinbaseKeyRow[];


  const allocationRows =
    (
      Array.isArray(
        allocationResult.data
      )
        ? allocationResult.data
        : []
    ) as unknown as AllocationRow[];


  /*
   * ========================================================
   * INDEX SOURCE DATA
   * ========================================================
   */


  const atlasEntitledUserIds =
    new Set(
      entitlementRows
        .filter(
          (row) =>
            row.atlas === true
        )
        .map(
          (row) =>
            row.user_id
        )
        .filter(Boolean)
    );


  /*
   * Entitlement controls Atlas product access.
   *
   * Therefore an active subscription plus atlas=true is
   * sufficient; we do not rely on the subscription plan name
   * containing the literal word "atlas".
   */
  const activeSubscriptionUserIds =
    new Set(
      subscriptionRows
        .filter(
          (row) =>
            String(
              row.status ??
              ""
            ).toLowerCase() ===
            "active"
        )
        .map(
          (row) =>
            row.user_id
        )
        .filter(Boolean)
    );


  const atlasKeyUserIds =
    new Set(
      keyRows
        .map(
          (row) =>
            row.user_id
        )
        .filter(Boolean)
    );


  const allocationsByUserId =
    new Map<
      string,
      AllocationRow[]
    >();


  for (
    const row
    of allocationRows
  ) {

    if (!row.user_id) {
      continue;
    }


    const existing =
      allocationsByUserId.get(
        row.user_id
      ) ?? [];


    existing.push(
      row
    );


    allocationsByUserId.set(
      row.user_id,
      existing
    );
  }


  /*
   * Candidate universe is intentionally based on Atlas
   * entitlement.
   *
   * Old Coinbase keys alone cannot place someone into the
   * Multi-Asset processing roster.
   */
  const candidateUserIds =
    [
      ...atlasEntitledUserIds,
    ]
      .sort();


  const clients:
    AtlasMultiAssetRosterClient[] =
      candidateUserIds.map(
        (
          userId
        ) => {

          const atlasEntitled =
            atlasEntitledUserIds.has(
              userId
            );


          const subscriptionActive =
            activeSubscriptionUserIds.has(
              userId
            );


          const atlasKeyConnected =
            atlasKeyUserIds.has(
              userId
            );


          const allocations =
            allocationsByUserId.get(
              userId
            ) ?? [];


          const allocationCount =
            allocations.length;


          const allocationTotalPercent =
            percent(
              allocations.reduce(
                (
                  total,
                  row
                ) =>
                  total +
                  Number(
                    row.target_percent ??
                    0
                  ),
                0
              )
            );


          let reason:
            AtlasMultiAssetRosterClient["reason"] =
              "eligible";


          if (!atlasEntitled) {

            reason =
              "atlas_not_entitled";

          } else if (
            !subscriptionActive
          ) {

            reason =
              "subscription_not_active";

          } else if (
            !atlasKeyConnected
          ) {

            reason =
              "atlas_coinbase_key_missing";

          } else if (
            allocationCount ===
            0
          ) {

            reason =
              "allocation_missing";

          } else if (
            Math.abs(
              allocationTotalPercent -
              100
            ) > 0.000001
          ) {

            reason =
              "allocation_total_not_100";
          }


          return {
            userId,

            eligible:
              reason ===
              "eligible",

            reason,

            atlasEntitled,

            subscriptionActive,

            atlasKeyConnected,

            allocationCount,

            allocationTotalPercent,
          };
        }
      );


  const eligibleUserIds =
    clients
      .filter(
        (
          client
        ) =>
          client.eligible
      )
      .map(
        (
          client
        ) =>
          client.userId
      );


  return {
    eligibleUserIds,

    clients,

    summary: {
      considered:
        clients.length,

      eligible:
        eligibleUserIds.length,

      blocked:
        clients.length -
        eligibleUserIds.length,
    },
  };
}