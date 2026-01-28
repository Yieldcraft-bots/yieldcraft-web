// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * REQUIRED ENVS:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * STRONGLY RECOMMENDED:
 * When you create the Stripe Checkout Session, set ONE of these to the Supabase user id (uuid):
 * - session.metadata.user_id
 * - session.client_reference_id
 *
 * This lets the webhook auto-assign entitlements with no manual clicking.
 */

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isUuid(v: any) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function inferEntitlementsFromText(text: string) {
  const t = (text || "").toLowerCase();

  // Baseline: any paid-ish plan -> Pulse
  const pulse =
    t.includes("pulse") || t.includes("pro") || t.includes("suite") || t.includes("all") || t.includes("premium");

  const recon =
    t.includes("recon") || t.includes("pro") || t.includes("suite") || t.includes("all");

  const atlas =
    t.includes("atlas") || t.includes("wealth") || t.includes("allocation") || t.includes("pro") || t.includes("suite") || t.includes("all");

  // If we found nothing, keep locked
  if (!pulse && !recon && !atlas) return { pulse: false, recon: false, atlas: false };

  return { pulse, recon, atlas };
}

async function resolveUserId(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  stripeCustomerId?: string | null;
  email?: string | null;
  metadataUserId?: string | null;
  clientReferenceId?: string | null;
}) {
  const { supabaseUrl, serviceRoleKey, stripeCustomerId, email, metadataUserId, clientReferenceId } = params;

  // 1) metadata.user_id
  if (metadataUserId && isUuid(metadataUserId)) return metadataUserId;

  // 2) client_reference_id
  if (clientReferenceId && isUuid(clientReferenceId)) return clientReferenceId;

  // 3) Try profiles by stripe_customer_id or email (defensive)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (stripeCustomerId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data?.id && isUuid(data.id)) return data.id;
  }

  if (email) {
    // profiles may or may not have email; if it errors, ignore
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      // @ts-ignore
      .eq("email", email)
      .maybeSingle();

    if (!error && data?.id && isUuid(data.id)) return data.id;
  }

  // 4) Try users table (if you have one)
  if (email) {
    const { data, error } = await admin
      .from("users")
      .select("id")
      // @ts-ignore
      .eq("email", email)
      .maybeSingle();

    if (!error && data?.id && isUuid(data.id)) return data.id;
  }

  return null;
}

async function writeEntitlements(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  ent: { pulse: boolean; recon: boolean; atlas: boolean };
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  source: string;
}) {
  const { supabaseUrl, serviceRoleKey, userId, ent, stripeCustomerId, stripeSubscriptionId, source } = params;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Update profiles with stripe_customer_id if possible (non-fatal if profiles doesn't exist)
  if (stripeCustomerId) {
    try {
      await admin
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", userId);
    } catch {
      // ignore
    }
  }

  // Insert an entitlements row (source of truth is latest row)
  const { error: entErr } = await admin.from("entitlements").insert({
    user_id: userId,
    pulse: !!ent.pulse,
    recon: !!ent.recon,
    atlas: !!ent.atlas,
    max_trade_size: 0,
    risk_mode: "safe",
  });

  if (entErr) {
    // If a strict schema differs, fail loudly for visibility but still return 200 to Stripe
    console.log("[stripe.webhook] entitlements insert error:", entErr.message);
  }

  // Optional: keep subscriptions table updated if it exists
  if (stripeSubscriptionId) {
    try {
      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_subscription_id: stripeSubscriptionId,
          status: "active",
          source,
        },
        // If you don't have a unique constraint, upsert may fail; we swallow.
        // @ts-ignore
        { onConflict: "stripe_subscription_id" }
      );
    } catch {
      // ignore
    }
  }
}

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !webhookSecret) {
    return json(500, { ok: false, error: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const stripe = new Stripe(secretKey, {
    // Keep this permissive to avoid build failures if the exact version string differs
    apiVersion: "2024-06-20" as any,
  });

  let event: Stripe.Event;

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) throw new Error("Missing stripe-signature header");

    // Next.js Route Handlers: req.text() is the correct raw payload for Stripe verification
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return json(400, {
      ok: false,
      error: `Webhook signature verification failed: ${err?.message || "unknown"}`,
    });
  }

  try {
    console.log("[stripe.webhook] received:", event.type);

    // We’ll attempt to infer entitlements from:
    // - Checkout Session line items / product text
    // - Subscription item price/product text
    // and resolve userId from metadata / client_reference_id / profiles lookup.
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;

      const stripeCustomerId = (typeof session.customer === "string" ? session.customer : session.customer?.id) ?? null;
      const email = session.customer_details?.email ?? session.customer_email ?? null;

      // Pull line items to infer tier
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const textBits: string[] = [];

      for (const li of lineItems.data) {
        const d: any = li;
        if (d.description) textBits.push(String(d.description));
        const price: any = d.price;
        if (price?.nickname) textBits.push(String(price.nickname));
        if (price?.id) textBits.push(String(price.id));
        if (price?.product) textBits.push(String(price.product));
      }

      // Also include metadata hints
      const meta = (session.metadata || {}) as Record<string, string>;
      Object.values(meta).forEach((v) => v && textBits.push(String(v)));

      const ent = inferEntitlementsFromText(textBits.join(" "));

      const userId = await resolveUserId({
        supabaseUrl,
        serviceRoleKey,
        stripeCustomerId,
        email,
        metadataUserId: meta.user_id ?? null,
        clientReferenceId: (session.client_reference_id as string | null) ?? null,
      });

      if (!userId) {
        console.log("[stripe.webhook] could not resolve user_id for checkout session", {
          session_id: session.id,
          stripeCustomerId,
          email,
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
        });
        // Return 200 so Stripe doesn't retry forever; you can inspect logs and fix checkout metadata.
        return json(200, { ok: true, received: true, type: event.type, warning: "user_id_not_resolved" });
      }

      const subscriptionId =
        (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) ?? null;

      await writeEntitlements({
        supabaseUrl,
        serviceRoleKey,
        userId,
        ent,
        stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        source: "stripe:checkout",
      });

      return json(200, { ok: true, received: true, type: event.type, user_id: userId, entitlements: ent });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const stripeCustomerId = (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ?? null;
      const meta = (sub.metadata || {}) as Record<string, string>;

      // Infer from subscription items
      const textBits: string[] = [];
      for (const item of sub.items.data) {
        const price: any = item.price;
        if (price?.nickname) textBits.push(String(price.nickname));
        if (price?.id) textBits.push(String(price.id));
        if (price?.product) textBits.push(String(price.product));
      }
      Object.values(meta).forEach((v) => v && textBits.push(String(v)));

      const ent = inferEntitlementsFromText(textBits.join(" "));

      const userId = await resolveUserId({
        supabaseUrl,
        serviceRoleKey,
        stripeCustomerId,
        email: null,
        metadataUserId: meta.user_id ?? null,
        clientReferenceId: meta.client_reference_id ?? null,
      });

      if (!userId) {
        console.log("[stripe.webhook] could not resolve user_id for subscription", {
          subscription_id: sub.id,
          stripeCustomerId,
          metadata: sub.metadata,
        });
        return json(200, { ok: true, received: true, type: event.type, warning: "user_id_not_resolved" });
      }

      // If deleted/canceled => lock
      const status = sub.status;
      const isActiveLike = status === "active" || status === "trialing";
      const finalEnt = isActiveLike ? ent : { pulse: false, recon: false, atlas: false };

      await writeEntitlements({
        supabaseUrl,
        serviceRoleKey,
        userId,
        ent: finalEnt,
        stripeCustomerId,
        stripeSubscriptionId: sub.id,
        source: `stripe:subscription:${event.type}`,
      });

      return json(200, { ok: true, received: true, type: event.type, user_id: userId, entitlements: finalEnt });
    }

    // Default: acknowledge other events
    return json(200, { ok: true, received: true, type: event.type });
  } catch (err: any) {
    console.log("[stripe.webhook] handler error:", err?.message || err);
    // Important: return 200 only if you *never* want retries. Here we return 500 to allow Stripe to retry transient errors.
    return json(500, { ok: false, error: err?.message || "webhook_handler_failed" });
  }
}
