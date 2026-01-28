// src/app/api/stripe/webhook/route.ts
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
 * Price → entitlements mapping
 * Set these in Vercel env so you never hardcode IDs:
 *  STRIPE_PRICE_PULSE_STARTER
 *  STRIPE_PRICE_PULSE_RECON
 *  STRIPE_PRICE_ATLAS
 *  STRIPE_PRICE_PRO_SUITE
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

async function resolveUserIdByEmail(supabaseAdmin: any, email: string) {
  // 1) Prefer admin lookup if available (SDK differences)
  try {
    const admin = supabaseAdmin.auth?.admin as any;
    if (admin?.getUserByEmail) {
      const res = await admin.getUserByEmail(email);
      const user = res?.data?.user;
      if (user?.id) return user.id;
    }
  } catch {
    // ignore and fall through
  }

  // 2) Fallback to profiles table (common pattern)
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!error && data?.id) return data.id;
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
  const secretKey = mustEnv("STRIPE_SECRET_KEY");
  const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET");

  // We need service role to safely write entitlements + look up users by email
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
    const sig = req.headers.get("stripe-signature");
    if (!sig) return json(400, { ok: false, error: "missing_stripe_signature" });

    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    const type = event.type;
    console.log("[stripe.webhook] received:", type);

    const relevant =
      type === "checkout.session.completed" ||
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted" ||
      type === "invoice.paid" ||
      type === "invoice.payment_failed";

    if (!relevant) {
      return json(200, { ok: true, ignored: true, type });
    }

    let email: string | null = null;
    let customerId: string | null = null;
    let subscriptionId: string | null = null;

    if (type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      email =
        (s.customer_details as any)?.email ||
        (s as any)?.customer_email ||
        null;
      customerId = (s.customer as any) || null;
      subscriptionId = (s.subscription as any) || null;
    } else if (type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      customerId = (sub.customer as any) || null;
      subscriptionId = sub.id || null;
    } else if (type.startsWith("invoice.")) {
      const inv = event.data.object as Stripe.Invoice;
      customerId = (inv.customer as any) || null;
      // FIX: Stripe types sometimes omit subscription on Invoice; payload has it.
      subscriptionId = ((inv as any).subscription as any) || null;
      email = ((inv as any).customer_email as any) || null;
    }

    if (!subscriptionId) {
      return json(200, {
        ok: true,
        mapped: false,
        reason: "no_subscription_id",
        type,
      });
    }

    const priceId = await getSubscriptionPriceId(stripe, subscriptionId);
    if (!priceId) {
      return json(200, {
        ok: true,
        mapped: false,
        reason: "no_price_id",
        type,
        subscriptionId,
      });
    }

    const ent = entitlementsFromPrice(priceId);

    let userId: string | null = null;
    if (email) {
      userId = await resolveUserIdByEmail(supabaseAdmin, email);
    }

    if (!userId) {
      return json(200, {
        ok: true,
        mapped: false,
        reason: "no_user_match_for_email",
        email,
        customerId,
        subscriptionId,
        priceId,
        entitlements: ent,
        type,
      });
    }

    const { error: entErr } = await supabaseAdmin.from("entitlements").insert({
      user_id: userId,
      pulse: ent.pulse,
      recon: ent.recon,
      atlas: ent.atlas,
      created_at: new Date().toISOString(),
    });

    if (entErr) {
      console.log(
        "[stripe.webhook] entitlements insert error:",
        entErr?.message || entErr
      );
      return json(500, { ok: false, error: "entitlements_insert_failed" });
    }

    // Optional: track subscription (safe if table exists)
    try {
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          status:
            type === "customer.subscription.deleted" ? "canceled" : "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
    } catch {
      // ignore
    }

    return json(200, {
      ok: true,
      mapped: true,
      user_id: userId,
      email,
      customerId,
      subscriptionId,
      priceId,
      entitlements: ent,
      type,
    });
  } catch (err: any) {
    console.log("[stripe.webhook] ERROR:", err?.message || err);
    return json(400, {
      ok: false,
      error: `Webhook signature verification failed: ${err?.message || "unknown"}`,
    });
  }
}
