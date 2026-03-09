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
 * GET = DEPLOYMENT PROOF CHECK (does not affect Stripe)
 */
export async function GET() {
  return json(200, {
    ok: true,
    route: "api/stripe/webhook",
    version: "entitlements_writer_v5_affiliate_before_user_match",
    ts: new Date().toISOString(),
  });
}

/**
 * Price → entitlements mapping
 * Set these in Vercel env:
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

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
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

/**
 * Idempotent entitlements write:
 * - If entitlements row exists for user_id -> UPDATE
 * - Else INSERT
 */
async function setEntitlements(supabaseAdmin: any, userId: string, ent: any) {
  const { data: upd, error: updErr } = await supabaseAdmin
    .from("entitlements")
    .update({
      pulse: !!ent.pulse,
      recon: !!ent.recon,
      atlas: !!ent.atlas,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (!updErr && upd?.user_id) return { ok: true, mode: "update" };

  const { error: insErr } = await supabaseAdmin.from("entitlements").insert({
    user_id: userId,
    pulse: !!ent.pulse,
    recon: !!ent.recon,
    atlas: !!ent.atlas,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insErr) return { ok: false, error: insErr?.message || insErr };
  return { ok: true, mode: "insert" };
}

/**
 * Resolve user by Stripe customer id via our subscriptions table
 */
async function resolveUserIdByCustomerId(
  supabaseAdmin: any,
  customerId: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.user_id) return data.user_id as string;
  } catch {
    // ignore
  }
  return null;
}

async function upsertSubscriptionRow(
  supabaseAdmin: any,
  row: {
    user_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string;
    stripe_price_id: string | null;
    status: "active" | "canceled" | "past_due";
  }
) {
  try {
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: row.user_id,
        stripe_customer_id: row.stripe_customer_id,
        stripe_subscription_id: row.stripe_subscription_id,
        stripe_price_id: row.stripe_price_id,
        status: row.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );
  } catch {
    // ignore if table/constraint not present
  }
}

function extractAffiliateCode(clientReferenceId: string | null | undefined) {
  const raw = String(clientReferenceId || "").trim();
  if (!raw) return null;
  if (!raw.startsWith("aff_")) return null;
  const code = raw.slice(4).trim();
  return code || null;
}

async function findAffiliateByCode(
  supabaseAdmin: any,
  affiliateCode: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("affiliates")
      .select("id, affiliate_code, commission_rate")
      .eq("affiliate_code", affiliateCode)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function insertAffiliateConversion(
  supabaseAdmin: any,
  row: {
    affiliate_code: string;
    affiliate_id: string | null;
    customer_email: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string;
    stripe_price_id: string | null;
    amount: number | null;
    commission_amount: number | null;
  }
) {
  try {
    const { error } = await supabaseAdmin.from("affiliate_conversions").insert({
      affiliate_code: row.affiliate_code,
      affiliate_id: row.affiliate_id,
      customer_email: row.customer_email,
      stripe_customer_id: row.stripe_customer_id,
      stripe_subscription_id: row.stripe_subscription_id,
      stripe_price_id: row.stripe_price_id,
      amount: row.amount,
      commission_amount: row.commission_amount,
    });

    if (error) {
      console.log(
        "[stripe.webhook] affiliate conversion insert error:",
        error.message || error
      );
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err: any) {
    console.log(
      "[stripe.webhook] affiliate conversion insert exception:",
      err?.message || err
    );
    return { ok: false, error: err };
  }
}

export async function POST(req: Request) {
  const secretKey = mustEnv("STRIPE_SECRET_KEY");
  const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET");

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
    if (!sig) {
      return json(400, { ok: false, error: "missing_stripe_signature" });
    }

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

    if (!relevant) return json(200, { ok: true, ignored: true, type });

    let email: string | null = null;
    let customerId: string | null = null;
    let subscriptionId: string | null = null;
    let clientReferenceId: string | null = null;
    let checkoutAmountTotal: number | null = null;

    if (type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      email =
        (s.customer_details as any)?.email ||
        (s as any)?.customer_email ||
        null;
      customerId = (s.customer as any) || null;
      subscriptionId = (s.subscription as any) || null;
      clientReferenceId = (s.client_reference_id as any) || null;
      checkoutAmountTotal =
        typeof s.amount_total === "number" ? s.amount_total / 100 : null;
    } else if (type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      customerId = (sub.customer as any) || null;
      subscriptionId = sub.id || null;
    } else if (type.startsWith("invoice.")) {
      const inv = event.data.object as Stripe.Invoice;
      customerId = (inv.customer as any) || null;
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

    const isCanceled = type === "customer.subscription.deleted";
    const ent = isCanceled
      ? { pulse: false, recon: false, atlas: false }
      : entitlementsFromPrice(priceId);

    /**
     * SAFE CHANGE:
     * Log affiliate conversion FIRST on checkout completion,
     * even if no app user match exists yet.
     */
    let affiliateLogged = false;
    let affiliateCode: string | null = null;

    if (type === "checkout.session.completed" && clientReferenceId) {
      affiliateCode = extractAffiliateCode(clientReferenceId);

      if (affiliateCode) {
        const affiliate = await findAffiliateByCode(
          supabaseAdmin,
          affiliateCode
        );

        if (affiliate) {
          const commissionRate =
            typeof affiliate.commission_rate === "number"
              ? affiliate.commission_rate
              : Number(affiliate.commission_rate || 0);

          const amount = checkoutAmountTotal;
          const commissionAmount =
            typeof amount === "number"
              ? Number(((amount * commissionRate) / 100).toFixed(2))
              : null;

          const conv = await insertAffiliateConversion(supabaseAdmin, {
            affiliate_code: affiliateCode,
            affiliate_id: affiliate.id || null,
            customer_email: email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            amount,
            commission_amount: commissionAmount,
          });

          affiliateLogged = !!conv.ok;
        } else {
          console.log(
            "[stripe.webhook] affiliate code not found:",
            affiliateCode
          );
        }
      }
    }

    /**
     * USER MATCHING FOR ENTITLEMENTS / SUBSCRIPTIONS
     * This remains protected and only runs when we can resolve a user.
     */
    let userId: string | null = null;

    if (email) userId = await resolveUserIdByEmail(supabaseAdmin, email);

    if (!userId && customerId) {
      userId = await resolveUserIdByCustomerId(supabaseAdmin, customerId);
    }

    if (!userId && customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        const cEmail = (c as any)?.email as string | undefined;
        if (cEmail) {
          email = email || cEmail;
          userId = await resolveUserIdByEmail(supabaseAdmin, cEmail);
        }
      } catch {
        // ignore
      }
    }

    /**
     * If no user match, do NOT fail the webhook.
     * Affiliate logging may still have succeeded, which is what we want.
     */
    if (!userId) {
      return json(200, {
        ok: true,
        mapped: false,
        reason: "no_user_match",
        type,
        email,
        customerId,
        subscriptionId,
        priceId,
        entitlements: ent,
        affiliate_code: affiliateCode,
        affiliate_logged: affiliateLogged,
      });
    }

    const entWrite = await setEntitlements(supabaseAdmin, userId, ent);
    if (!entWrite.ok) {
      console.log(
        "[stripe.webhook] entitlements write error:",
        entWrite.error
      );
      return json(500, { ok: false, error: "entitlements_write_failed" });
    }

    await upsertSubscriptionRow(supabaseAdmin, {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: isCanceled
        ? "canceled"
        : type === "invoice.payment_failed"
        ? "past_due"
        : "active",
    });

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
      ent_write: entWrite.mode,
      affiliate_code: affiliateCode,
      affiliate_logged: affiliateLogged,
    });
  } catch (err: any) {
    console.log("[stripe.webhook] ERROR:", err?.message || err);
    return json(400, {
      ok: false,
      error: `Webhook signature verification failed: ${
        err?.message || "unknown"
      }`,
    });
  }
}