import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { deriveAtlasOperationalStatus } from "@/lib/atlas-operational-status";

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
        autoRefreshToken: false,
      },
    }
  );
}

function normalizeEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isWithinLastDays(
  value: string | null | undefined,
  days: number
) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const cutoff =
    Date.now() - days * 24 * 60 * 60 * 1000;

  return timestamp >= cutoff;
}

export async function GET(request: Request) {
  try {
    const authorized =
      await isAuthorizedAdminRequest(request);

    if (!authorized) {
      return json(401, {
        ok: false,
        status: "UNAUTHORIZED",
        error: "Admin authorization is required.",
      });
    }

    const client = sbService();

    const [
      entitlementResult,
      subscriptionResult,
      pulseKeyResult,
      atlasKeyResult,
      atlasStateResult,
      authUsersResult,
    ] = await Promise.all([
      client
        .from("entitlements")
        .select(
          "user_id, atlas, pulse, created_at"
        ),

      client
        .from("subscriptions")
        .select(
          "user_id, plan, status, created_at"
        ),

      client
        .from("coinbase_keys")
        .select(
          "user_id, product_scope, created_at"
        )
        .eq("product_scope", "pulse"),

      client
        .from("atlas_coinbase_keys")
        .select(
          "user_id, product_scope, created_at"
        )
        .eq("product_scope", "atlas"),

      client
        .from("atlas_user_state")
        .select(
          "user_id, last_cash_available_usd, cooldown_until, notes"
        ),

      client.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ]);

    const entitlementRows = Array.isArray(
      entitlementResult.data
    )
      ? entitlementResult.data
      : [];

    const subscriptionRows = Array.isArray(
      subscriptionResult.data
    )
      ? subscriptionResult.data
      : [];

    const pulseKeyRows = Array.isArray(
      pulseKeyResult.data
    )
      ? pulseKeyResult.data
      : [];

    const atlasKeyRows = Array.isArray(
      atlasKeyResult.data
    )
      ? atlasKeyResult.data
      : [];

    const atlasStateRows = Array.isArray(
      atlasStateResult.data
    )
      ? atlasStateResult.data
      : [];

    const authUsers = Array.isArray(
      authUsersResult?.data?.users
    )
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
          created_at:
            user.created_at || null,
          last_sign_in_at:
            user.last_sign_in_at || null,
          email_confirmed_at:
            user.email_confirmed_at || null,
        },
      ])
    );

    const atlasStateByUserId = new Map(
      atlasStateRows
        .filter((row: any) => row.user_id)
        .map((row: any) => [
          row.user_id,
          row,
        ])
    );

    const atlasEntitledUserIds = new Set(
      entitlementRows
        .filter(
          (row: any) =>
            row.atlas === true
        )
        .map(
          (row: any) =>
            row.user_id
        )
        .filter(Boolean)
    );

    const pulseEntitledUserIds = new Set(
      entitlementRows
        .filter(
          (row: any) =>
            row.pulse === true
        )
        .map(
          (row: any) =>
            row.user_id
        )
        .filter(Boolean)
    );

    const activeSubscriptionUserIds =
      new Set(
        subscriptionRows
          .filter(
            (row: any) =>
              row.status === "active"
          )
          .map(
            (row: any) =>
              row.user_id
          )
          .filter(Boolean)
      );

    const atlasKeyUserIds = new Set(
      atlasKeyRows
        .filter(
          (row: any) =>
            row.product_scope ===
            "atlas"
        )
        .map(
          (row: any) =>
            row.user_id
        )
        .filter(Boolean)
    );

    const pulseKeyUserIds = new Set(
      pulseKeyRows
        .filter(
          (row: any) =>
            row.product_scope ===
            "pulse"
        )
        .map(
          (row: any) =>
            row.user_id
        )
        .filter(Boolean)
    );

    const userIds = new Set<string>();

    for (
      const row of entitlementRows as any[]
    ) {
      if (row.user_id) {
        userIds.add(row.user_id);
      }
    }

    for (
      const row of subscriptionRows as any[]
    ) {
      if (row.user_id) {
        userIds.add(row.user_id);
      }
    }

    for (
      const row of pulseKeyRows as any[]
    ) {
      if (row.user_id) {
        userIds.add(row.user_id);
      }
    }

    for (
      const row of atlasKeyRows as any[]
    ) {
      if (row.user_id) {
        userIds.add(row.user_id);
      }
    }

    const customers = [...userIds].map(
      (userId) => {
        const subscription = (
          subscriptionRows as any[]
        ).find(
          (row) =>
            row.user_id === userId
        );

        const auth =
          authByUserId.get(userId) || null;

        const atlasEntitled =
          atlasEntitledUserIds.has(userId);

        const pulseEntitled =
          pulseEntitledUserIds.has(userId);

        const atlasKeys =
          atlasKeyUserIds.has(userId);

        const pulseKeys =
          pulseKeyUserIds.has(userId);

        const activeSubscription =
          activeSubscriptionUserIds.has(
            userId
          );

        const atlasState =
          atlasStateByUserId.get(userId) ||
          null;

        const atlasOperationalStatus =
          atlasState
            ? deriveAtlasOperationalStatus(
                atlasState
              )
            : null;

        let nextAction = "No Action";
        let health = "Healthy";

        if (!activeSubscription) {
          nextAction =
            "Review Subscription";
          health = "Needs Attention";
        } else if (
          atlasEntitled &&
          !atlasKeys
        ) {
          nextAction =
            "Send Atlas Keys Reminder";
          health = "Needs Keys";
        } else if (
          pulseEntitled &&
          !pulseKeys
        ) {
          nextAction =
            "Send Pulse Keys Reminder";
          health = "Needs Keys";
        } else if (
          atlasEntitled &&
          atlasKeys &&
          atlasOperationalStatus?.status ===
            "NEEDS_FUNDS"
        ) {
          nextAction =
            "Fund Atlas Account";
          health = "Needs Funds";
        } else if (
          atlasEntitled &&
          atlasKeys &&
          atlasOperationalStatus?.status ===
            "COOLDOWN"
        ) {
          nextAction =
            "Atlas Cooldown";
          health = "Cooldown";
        }

        return {
          user_id: userId,
          email:
            auth?.email || null,
          display_name:
            auth?.display_name || null,
          customer_label:
            auth?.display_name ||
            auth?.email ||
            userId,
          signup_at:
            auth?.created_at || null,
          last_sign_in_at:
            auth?.last_sign_in_at || null,
          email_confirmed_at:
            auth?.email_confirmed_at || null,
          plan:
            subscription?.plan || null,
          subscription_status:
            subscription?.status ||
            null,
          atlas_entitled:
            atlasEntitled,
          pulse_entitled:
            pulseEntitled,
          atlas_key_connected:
            atlasKeys,
          pulse_key_connected:
            pulseKeys,
          atlas_operational_status:
            atlasOperationalStatus?.status ||
            null,
          atlas_operational_reason:
            atlasOperationalStatus?.reason ||
            null,
          atlas_cash_available_usd:
            atlasOperationalStatus
              ?.cash_available_usd ??
            null,
          atlas_cooldown_active:
            atlasOperationalStatus
              ?.cooldown_active ??
            false,
          health,
          next_action: nextAction,
        };
      }
    );

    customers.sort((a, b) => {
      const aTime = a.signup_at
        ? new Date(a.signup_at).getTime()
        : 0;

      const bTime = b.signup_at
        ? new Date(b.signup_at).getTime()
        : 0;

      return bTime - aTime;
    });

    const newThisWeek =
      customers.filter((customer) =>
        isWithinLastDays(
          customer.signup_at,
          7
        )
      ).length;

    const waitingKeys =
      customers.filter((customer) =>
        customer.next_action.includes(
          "Keys"
        )
      ).length;

    const readyForAtlas =
      customers.filter(
        (customer) =>
          customer.subscription_status ===
            "active" &&
          customer.atlas_entitled &&
          customer.atlas_key_connected &&
          customer.atlas_operational_status ===
            "READY"
      ).length;

    return json(200, {
      ok: true,
      as_of: new Date().toISOString(),
      source:
        "customer_success_read_only_v3",
      summary: {
        total_customers:
          customers.length,
        new_this_week:
          newThisWeek,
        waiting_keys:
          waitingKeys,
        ready_for_atlas:
          readyForAtlas,
      },
      onboarding: {
        total_customers:
          customers.length,
        new_signups_7d:
          newThisWeek,
        waiting_for_keys:
          waitingKeys,
        ready_for_atlas:
          readyForAtlas,
      },
      communication: {
        keys_reminder:
          waitingKeys,
        action_required:
          customers.filter(
            (customer) =>
              customer.next_action !==
              "No Action"
          ).length,
      },
      customers,
      diagnostics: {
        entitlements_ok:
          !entitlementResult.error,
        subscriptions_ok:
          !subscriptionResult.error,
        pulse_keys_ok:
          !pulseKeyResult.error,
        atlas_keys_ok:
          !atlasKeyResult.error,
        atlas_state_ok:
          !atlasStateResult.error,
        auth_users_ok:
          !authUsersResult.error,
        keys_ok:
          !pulseKeyResult.error &&
          !atlasKeyResult.error,
        entitlements_error:
          entitlementResult.error
            ?.message || null,
        subscriptions_error:
          subscriptionResult.error
            ?.message || null,
        pulse_keys_error:
          pulseKeyResult.error
            ?.message || null,
        atlas_keys_error:
          atlasKeyResult.error
            ?.message || null,
        atlas_state_error:
          atlasStateResult.error
            ?.message || null,
        auth_users_error:
          authUsersResult.error
            ?.message || null,
        keys_error:
          pulseKeyResult.error
            ?.message ||
          atlasKeyResult.error
            ?.message ||
          null,
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status:
        "CUSTOMER_SUCCESS_ERROR",
      error:
        e?.message || String(e),
    });
  }
}