// src/app/api/admin/stripe-sync/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
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
 * GET = PROOF CHECK (safe)
 */
export async function GET() {
  return json(200, {
    ok: true,
    route: "api/admin/stripe-sync",
    version: "stripe-sync-v3_case_insensitive_email_fix",
    note: "Use POST with x-admin-token to run sync.",
    ts: new Date().toISOString(),
  });
}

/**
 * Price → entitlements mapping (env-driven)
 */
function entitlementsFromPrice(priceId: string) {
  const PULSE_STARTER = process.env.STRIPE_PRICE_PULSE_STARTER || "";
  const PULSE_RECON = process.env.STRIPE_PRICE_PULSE_RECON || "";
  const ATLAS = process.env.STRIPE_PRICE_ATLAS || "";
  const PRO = process.env.STRIPE_PRICE_PRO_SUITE || "";

  let pulse = false;
  let recon = false;
  let atlas = false;

  if (priceId === PULSE_STARTER) {
    pulse = true;
  } else if (priceId === PULSE_RECON) {
    pulse = true;
    recon = true;
  } else if (priceId === ATLAS) {
    atlas = true;
  } else if (priceId === PRO) {
    pulse = true;
    recon = true;
    atlas = true;
  }

  return { pulse, recon, atlas };
}

function normalizeEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

async function resolveUserIdByEmail(supabaseAdmin: any, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  if (!email) return null;

  // 1) Prefer admin lookup if available
  try {
    const admin = supabaseAdmin.auth?.admin as any;
    if (admin?.getUserByEmail) {
      const res = await admin.getUserByEmail(email);
      const user = res?.data?.user;
      if (user?.id) return user.id as string;
    }
  } catch {
    // ignore
  }

  // 2) Fallback to profiles table (case-insensitive)
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!error && data?.id) return data.id as string;
  } catch {
    // ignore
  }

  return null;
}

async function getSubscriptionPriceId(stripe: Stripe, subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const firstItem = sub.items?.data?.[0];
  const price = (firstItem as any)?.price;
  const priceId = price?.id;

  return priceId || null;
}

export async function POST(req: Request) {
  const adminToken = mustEnv("ADMIN_SYNC_TOKEN");
  const got = req.headers.get("x-admin-token") || "";
  if (got !== adminToken) return json(401, { ok: false, error: "Unauthorized" });

  const secretKey = mustEnv("STRIPE_SECRET_KEY");

  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-06-30.basil" as any,
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const url = new URL(req.url);
    const limit = Math.max(
      1,
      Math.min(250, Number(url.searchParams.get("limit") || "50"))
    );

    const counts = {
      fetched: 0,
      updatedEntitlements: 0,
      updatedSubscriptions: 0,
      skippedNoEmail: 0,
      skippedNoUser: 0,
      skippedNoPrice: 0,
    };

    // Pull active subscriptions (expand to get email + items)
    const subs = await stripe.subscriptions.list({
      limit,
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
    });

    counts.fetched = subs.data.length;

    const results: any[] = [];

    for (const sub of subs.data) {
      const subscriptionId = sub.id;
      const customerId = (sub.customer as any)?.id || (sub.customer as any) || null;

      // Email can exist on customer object (expanded) or be missing
      const email =
        normalizeEmail((sub.customer as any)?.email || "") ||
        normalizeEmail((sub as any)?.customer_email || "");

      // Price: first subscription item
      const priceId =
        (sub.items?.data?.[0] as any)?.price?.id ||
        (sub.items?.data?.[0] as any)?.price ||
        null;

      if (!email) {
        counts.skippedNoEmail++;
        results.push({
          subscriptionId,
          customerId,
          priceId,
          email: null,
          ok: false,
          reason: "no_email",
        });
        continue;
      }

      let finalPriceId = priceId;
      if (!finalPriceId) {
        // fallback: retrieve with expand
        finalPriceId = await getSubscriptionPriceId(stripe, subscriptionId);
      }

      if (!finalPriceId) {
        counts.skippedNoPrice++;
        results.push({
          subscriptionId,
          customerId,
          priceId: null,
          email,
          ok: false,
          reason: "no_price",
        });
        continue;
      }

      const ent = entitlementsFromPrice(finalPriceId);

      const userId = await resolveUserIdByEmail(supabaseAdmin, email);
      if (!userId) {
        counts.skippedNoUser++;
        results.push({
          subscriptionId,
          customerId,
          priceId: finalPriceId,
          email,
          ok: false,
          reason: "no_user_match_for_email",
        });
        continue;
      }

      // ✅ Entitlements upsert (idempotent)
      const { error: entErr } = await supabaseAdmin.from("entitlements").upsert(
        {
          user_id: userId,
          pulse: ent.pulse,
          recon: ent.recon,
          atlas: ent.atlas,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (!entErr) counts.updatedEntitlements++;

      // ✅ Subscriptions upsert (safe if table exists)
      try {
        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: finalPriceId,
            status: sub.status || "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        );
        counts.updatedSubscriptions++;
      } catch {
        // ignore if table missing
      }

      results.push({
        subscriptionId,
        customerId,
        priceId: finalPriceId,
        email,
        ok: true,
        entitlements: ent,
        userId,
      });
    }

    return json(200, { ok: true, ran: true, limit, counts, results });
  } catch (err: any) {
    console.log("[stripe-sync] ERROR:", err?.message || err);
    return json(500, { ok: false, error: err?.message || "unknown_error" });
  }
}
