import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET() {
  try {
    const client = sbService();

    const [
      entitlementResult,
      subscriptionResult,
      pulseKeyResult,
      atlasKeyResult,
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
            "Send Keys Reminder";
          health = "Needs Keys";
        } else if (
          pulseEntitled &&
          !pulseKeys
        ) {
          nextAction =
            "Send Pulse Keys Reminder";
          health = "Needs Keys";
        }

        return {
          user_id: userId,
          plan:
            subscription?.plan || null,
          subscription_status:
            subscription?.status ||
            null,
          signup_at:
            subscription?.created_at ||
            null,
          atlas_entitled:
            atlasEntitled,
          pulse_entitled:
            pulseEntitled,
          atlas_key_connected:
            atlasKeys,
          pulse_key_connected:
            pulseKeys,
          health,
          next_action: nextAction,
        };
      }
    );

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
          customer.atlas_key_connected
      ).length;

    return json(200, {
      ok: true,
      as_of: new Date().toISOString(),
      source:
        "customer_success_read_only_v1",
      summary: {
        new_this_week: customers.length,
        awaiting_welcome: 0,
        waiting_keys: waitingKeys,
        ready_for_atlas:
          readyForAtlas,
      },
      onboarding: {
        new_signups: customers.length,
        awaiting_welcome: 0,
        waiting_for_keys:
          waitingKeys,
        ready_for_atlas:
          readyForAtlas,
        needs_funding: 0,
      },
      communication: {
        welcome_pending: 0,
        keys_reminder: waitingKeys,
        weekly_summary_due: 0,
        platform_updates: 0,
        action_required:
          waitingKeys,
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