// src/app/api/admin/stripe-sync/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Stripe -> Supabase Sync (schema-aligned)
 *
 * Writes ONLY to existing columns:
 *  - public.entitlements: user_id, pulse, recon, atlas, max_trade_size, risk_mode, created_at
 *  - public.subscriptions: user_id, plan, status, stripe_customer_id, created_at
 *
 * NOTE: This endpoint is designed to be run manually (curl) and later by a cron.
 * It will also detect cancellations on subsequent runs (status becomes canceled/unpaid/etc),
 * and will remove entitlements accordingly.
 */
export async function POST(req: Request) {
  try {
    // --- Auth gate ---
    const headerToken = (req.headers.get("x-admin-token") || "").trim();
    const expected =
      process.env.YC_ADMIN_TOKEN ||
      process.env.ADMIN_TOKEN ||
      process.env.STRIPE_SYNC_TOKEN ||
      "";

    if (!expected) {
      return json(500, { ok: false, error: "missing_server_admin_token_env" });
    }
    if (!headerToken || headerToken !== expected) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    // --- Inputs ---
    const url = new URL(req.url);
    const limit = Math.max(
      1,
      Math.min(50, Number(url.searchParams.get("limit") || "25"))
    );

    // --- Clients ---
    const stripe = new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-06-20",
    });

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- Price -> Plan + Entitlements mapping (your known IDs) ---
    // Update these any time you add/change Stripe Prices.
    const PRICE_MAP: Record<
      string,
      { plan: string; pulse: boolean; recon: boolean; atlas: boolean }
    > = {
      // Pro Suite (All Bots) - $39
      price_1Sa0gWPzuWqVmXdYa4hlWgFp: {
        plan: "pro",
        pulse: true,
        recon: true,
        atlas: true,
      },

      // Pulse + Recon - $9
      price_1Sa0WlPzuWqVmXdY8DSH2v9b: {
        plan: "pulse_recon",
        pulse: true,
        recon: true,
        atlas: false,
      },

      // Atlas - $9
      price_1Sf61jPzuWqVmXdYQB8xe0BS: {
        plan: "atlas",
        pulse: false,
        recon: false,
        atlas: true,
      },

      // Pulse (legacy $9 you showed earlier in logs)
      price_1Sa0UvPzuWqVmXdYMzw6lCRm: {
        plan: "pulse",
        pulse: true,
        recon: false,
        atlas: false,
      },
    };

    const planRank = (p: string) =>
      p === "pro" ? 4 : p === "pulse_recon" ? 3 : p === "pulse" ? 2 : p === "atlas" ? 1 : 0;

    // --- Fetch subscriptions from Stripe ---
    // We pull "all" so we can detect cancellations too.
    const subs = await stripe.subscriptions.list({
      limit,
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
    });

    let updatedEntitlements = 0;
    let updatedSubscriptions = 0;
    let skippedNoEmail = 0;
    let skippedNoUser = 0;
    let skippedNoPrice = 0;

    const results: any[] = [];

    for (const sub of subs.data) {
      const customer = sub.customer as Stripe.Customer | Stripe.DeletedCustomer;
      const customerObj =
        customer && (customer as any).deleted ? null : (customer as Stripe.Customer);

      const email = (customerObj?.email || "").toLowerCase().trim();
      const stripeCustomerId = customerObj?.id || null;

      if (!email) {
        skippedNoEmail++;
        results.push({
          subscriptionId: sub.id,
          priceId: null,
          email: null,
          ok: false,
          reason: "no_email_on_customer",
        });
        continue;
      }

      // Find user by email in your public.profiles table (most common pattern)
      // If your table is named differently, tell me the name and we’ll swap it.
      const { data: profile, error: profErr } = await sb
        .from("profiles")
        .select("id,user_id,email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (profErr) {
        results.push({
          subscriptionId: sub.id,
          priceId: null,
          email,
          ok: false,
          reason: "profiles_lookup_failed",
          detail: profErr.message,
        });
        continue;
      }

      const userId = (profile as any)?.user_id || (profile as any)?.id || null;
      if (!userId) {
        skippedNoUser++;
        results.push({
          subscriptionId: sub.id,
          priceId: null,
          email,
          ok: false,
          reason: "no_user_match_for_email",
        });
        continue;
      }

      // Collect mapped priceIds from all items
      const priceIds: string[] = [];
      for (const item of sub.items.data || []) {
        const p = item.price?.id;
        if (p) priceIds.push(p);
      }

      // If no priceIds, skip
      if (!priceIds.length) {
        skippedNoPrice++;
        results.push({
          subscriptionId: sub.id,
          priceId: null,
          email,
          userId,
          ok: false,
          reason: "no_price_on_subscription_items",
        });
        continue;
      }

      // Fold entitlements across all recognized prices
      let ent = { pulse: false, recon: false, atlas: false };
      let pickedPlan = "free";

      let sawKnownPrice = false;
      for (const pid of priceIds) {
        const mapped = PRICE_MAP[pid];
        if (!mapped) continue;
        sawKnownPrice = true;

        ent = {
          pulse: ent.pulse || mapped.pulse,
          recon: ent.recon || mapped.recon,
          atlas: ent.atlas || mapped.atlas,
        };

        if (planRank(mapped.plan) > planRank(pickedPlan)) {
          pickedPlan = mapped.plan;
        }
      }

      if (!sawKnownPrice) {
        skippedNoPrice++;
        results.push({
          subscriptionId: sub.id,
          priceIds,
          email,
          userId,
          ok: false,
          reason: "no_known_price_mapping",
        });
        continue;
      }

      // Only grant entitlements when subscription is active or trialing
      const isPaidActive = sub.status === "active" || sub.status === "trialing";
      const finalEnt = isPaidActive ? ent : { pulse: false, recon: false, atlas: false };

      // max_trade_size: enforce $10 cap when paid, otherwise 0
      const maxTradeSize = isPaidActive && (finalEnt.pulse || finalEnt.recon || finalEnt.atlas) ? 10 : 0;
      const riskMode = isPaidActive ? "normal" : "safe";

      // --- Upsert entitlements by user_id ---
      const { data: entRow, error: entErr } = await sb
        .from("entitlements")
        .upsert(
          {
            user_id: userId,
            pulse: finalEnt.pulse,
            recon: finalEnt.recon,
            atlas: finalEnt.atlas,
            max_trade_size: maxTradeSize,
            risk_mode: riskMode,
          },
          { onConflict: "user_id" }
        )
        .select("user_id,pulse,recon,atlas,max_trade_size,risk_mode")
        .maybeSingle();

      if (entErr) {
        results.push({
          subscriptionId: sub.id,
          priceIds,
          email,
          userId,
          ok: false,
          reason: "entitlements_write_failed",
          detail: entErr.message,
        });
        continue;
      } else {
        updatedEntitlements++;
      }

      // --- Insert a subscriptions row only if the latest row differs ---
      // Schema has NO updated_at, and you allow history rows.
      const { data: latest, error: latestErr } = await sb
        .from("subscriptions")
        .select("plan,status,stripe_customer_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) {
        results.push({
          subscriptionId: sub.id,
          priceIds,
          email,
          userId,
          ok: false,
          reason: "subscriptions_read_failed",
          detail: latestErr.message,
        });
        continue;
      }

      const nextStatus = String(sub.status || "unknown");
      const shouldInsert =
        !latest ||
        latest.plan !== pickedPlan ||
        latest.status !== nextStatus ||
        String(latest.stripe_customer_id || "") !== String(stripeCustomerId || "");

      if (shouldInsert) {
        const { error: insErr } = await sb.from("subscriptions").insert({
          user_id: userId,
          plan: pickedPlan,
          status: nextStatus,
          stripe_customer_id: stripeCustomerId || "unknown",
          created_at: new Date().toISOString(),
        });

        if (insErr) {
          results.push({
            subscriptionId: sub.id,
            priceIds,
            email,
            userId,
            ok: false,
            reason: "subscriptions_insert_failed",
            detail: insErr.message,
          });
          continue;
        } else {
          updatedSubscriptions++;
        }
      }

      results.push({
        subscriptionId: sub.id,
        priceIds,
        email,
        userId,
        plan: pickedPlan,
        status: sub.status,
        entitlements: finalEnt,
        ok: true,
      });
    }

    return json(200, {
      ok: true,
      ran: true,
      limit,
      counts: {
        fetched: subs.data.length,
        updatedEntitlements,
        updatedSubscriptions,
        skippedNoEmail,
        skippedNoUser,
        skippedNoPrice,
      },
      results,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "unknown_error" });
  }
}
