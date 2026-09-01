import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = process.env[name];

  if (!v || !v.trim()) {
    throw new Error(`Missing env: ${name}`);
  }

  return v.trim();
}

function sbService() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isCooldownActive(cooldownUntil?: string | null) {
  if (!cooldownUntil) {
    return false;
  }

  const t = new Date(cooldownUntil).getTime();

  return Number.isFinite(t) && t > Date.now();
}

function normalizeEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function healthFor(args: {
  status: string;
  atlasEntitled: boolean;
  atlasKeyConnected: boolean;
  subscriptionStatus: string | null;
  cash: number;
}) {
  if (!args.atlasEntitled) {
    return "LOCKED";
  }

  if (args.subscriptionStatus !== "active") {
    return "NEEDS_SUBSCRIPTION";
  }

  if (!args.atlasKeyConnected) {
    return "NEEDS_KEYS";
  }

  if (args.cash <= 0 || args.status === "NEEDS_FUNDS") {
    return "NEEDS_FUNDS";
  }

  if (args.status === "COOLDOWN") {
    return "COOLDOWN";
  }

  return "HEALTHY";
}

export async function GET(request: Request) {
  try {
    const authorized = await isAuthorizedAdminRequest(request);

    if (!authorized) {
      return json(401, {
        ok: false,
        status: "UNAUTHORIZED",
        error: "Admin authorization is required.",
      });
    }

    const client = sbService();

    const [
      stateResult,
      entitlementResult,
      subscriptionResult,
      keyResult,
      authUsersResult,
    ] = await Promise.all([
      client
        .from("atlas_user_state")
        .select("*")
        .order("user_id", { ascending: true }),

      client
        .from("entitlements")
        .select("user_id, atlas, pulse"),

      client
        .from("subscriptions")
        .select("user_id, plan, status"),

      client
        .from("atlas_coinbase_keys")
        .select("user_id, product_scope"),

      client.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ]);

    if (stateResult.error) {
      return json(500, {
        ok: false,
        status: "ATLAS_OPS_STATUS_READ_ERROR",
        error: stateResult.error.message,
      });
    }

    const rows = Array.isArray(stateResult.data)
      ? stateResult.data
      : [];

    const entitlementRows = Array.isArray(entitlementResult.data)
      ? entitlementResult.data
      : [];

    const subscriptionRows = Array.isArray(subscriptionResult.data)
      ? subscriptionResult.data
      : [];

    const keyRows = Array.isArray(keyResult.data)
      ? keyResult.data
      : [];

    const authUsers = Array.isArray(authUsersResult?.data?.users)
      ? authUsersResult.data.users
      : [];

    const authByUserId = new Map(
      authUsers.map((user: any) => [
        user.id,
        {
          email: normalizeEmail(user.email),
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.user_metadata?.display_name ||
            null,
          created_at: user.created_at || null,
          last_sign_in_at: user.last_sign_in_at || null,
          email_confirmed_at:
            user.email_confirmed_at || null,
        },
      ])
    );

    const entitlementByUserId = new Map(
      entitlementRows.map((row: any) => [
        row.user_id,
        row,
      ])
    );

    const subscriptionByUserId = new Map(
      subscriptionRows.map((row: any) => [
        row.user_id,
        row,
      ])
    );

    const atlasKeyUserIds = new Set(
      keyRows
        .filter(
          (row: any) =>
            row.product_scope === "atlas"
        )
        .map((row: any) => row.user_id)
        .filter(Boolean)
    );

    const summary = {
      total: rows.length,
      ready: 0,
      cooldown: 0,
      needs_funds: 0,
      error: 0,
    };

    const users = rows.map((row: any) => {
      const cash = num(
        row.last_cash_available_usd
      );

      const btc = num(
        row.last_btc_available
      );

      const cooldown = isCooldownActive(
        row.cooldown_until
      );

      const notes = row.notes || {};

      const allocationReason = String(
        notes.allocation_reason ||
          notes.reason ||
          ""
      );

      let status = "READY";
      let reason = "atlas_state_observed";

      if (cooldown) {
        status = "COOLDOWN";
        reason = "cooldown_active";
        summary.cooldown += 1;
      } else if (
        allocationReason.includes(
          "below_min_cash"
        ) ||
        allocationReason.includes(
          "insufficient"
        ) ||
        allocationReason.includes("cash")
      ) {
        status = "NEEDS_FUNDS";
        reason = allocationReason;
        summary.needs_funds += 1;
      } else if (cash <= 0) {
        status = "NEEDS_FUNDS";
        reason =
          "cash_available_zero_or_missing";
        summary.needs_funds += 1;
      } else {
        summary.ready += 1;
      }

      const auth =
        authByUserId.get(row.user_id) || null;

      const entitlement =
        entitlementByUserId.get(row.user_id) ||
        null;

      const subscription =
        subscriptionByUserId.get(row.user_id) ||
        null;

      const atlasEntitled =
        entitlement?.atlas === true;

      const atlasKeyConnected =
        atlasKeyUserIds.has(row.user_id);

      return {
        user_id: row.user_id,
        email: auth?.email || null,
        display_name:
          auth?.display_name || null,
        customer_label:
          auth?.display_name ||
          auth?.email ||
          row.user_id,
        created_at:
          auth?.created_at || null,
        last_sign_in_at:
          auth?.last_sign_in_at || null,
        email_confirmed_at:
          auth?.email_confirmed_at || null,

        plan: subscription?.plan || null,
        subscription_status:
          subscription?.status || null,
        atlas_entitled: atlasEntitled,
        pulse_entitled:
          entitlement?.pulse === true,
        atlas_key_connected:
          atlasKeyConnected,

        health: healthFor({
          status,
          atlasEntitled,
          atlasKeyConnected,
          subscriptionStatus:
            subscription?.status || null,
          cash,
        }),

        status,
        reason,
        cash_available_usd: cash,
        btc_available: btc,
        cooldown_until:
          row.cooldown_until || null,
        last_buy_at:
          row.last_buy_at || null,
        last_buy_amount_usd: num(
          row.last_buy_amount_usd
        ),
        last_buy_order_id:
          row.last_buy_order_id || null,
        market_state_used:
          row.market_state_used || null,
        notes: row.notes || null,
      };
    });

    const atlasEntitledUserIds = new Set(
      entitlementRows
        .filter(
          (row: any) =>
            row.atlas === true
        )
        .map((row: any) => row.user_id)
        .filter(Boolean)
    );

    const activeAtlasUserIds = new Set(
      subscriptionRows
        .filter((row: any) => {
          const plan = String(
            row.plan || ""
          ).toLowerCase();

          return (
            plan.includes("atlas") &&
            row.status === "active"
          );
        })
        .map((row: any) => row.user_id)
        .filter(Boolean)
    );

    const launchReady = [
      ...activeAtlasUserIds,
    ].filter((userId) =>
      atlasKeyUserIds.has(userId)
    ).length;

    const funnel = {
      atlas_entitled:
        atlasEntitledUserIds.size,

      launch_ready: launchReady,

      needs_atlas_keys: Math.max(
        0,
        activeAtlasUserIds.size - launchReady
      ),

      needs_atlas_subscription: Math.max(
        0,
        atlasEntitledUserIds.size -
          activeAtlasUserIds.size
      ),

      active_atlas_subscriptions:
        activeAtlasUserIds.size,

      atlas_keys_connected:
        atlasKeyUserIds.size,

      source:
        "entitlements_subscriptions_atlas_coinbase_keys_auth_users",

      ok:
        !entitlementResult.error &&
        !subscriptionResult.error &&
        !keyResult.error &&
        !authUsersResult.error,

      error:
        entitlementResult.error?.message ||
        subscriptionResult.error?.message ||
        keyResult.error?.message ||
        authUsersResult.error?.message ||
        null,
    };

    return json(200, {
      ok: true,
      as_of: new Date().toISOString(),
      source: "atlas_user_state",
      summary,
      funnel,
      users,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "ATLAS_OPS_STATUS_ERROR",
      error: e?.message || String(e),
    });
  }
}