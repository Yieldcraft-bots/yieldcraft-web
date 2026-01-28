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

function requireAdmin(req: Request) {
  // Set this in Vercel env (PROD):
  // ADMIN_SYNC_TOKEN = some-long-random-string
  const token = mustEnv("ADMIN_SYNC_TOKEN");

  const hdr =
    req.headers.get("x-admin-token") ||
    req.headers.get("X-Admin-Token") ||
    "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  const provided = hdr || bearer;

  if (!provided || provided !== token) {
    return { ok: false as const, error: "unauthorized" as const };
  }
  return { ok: true as const };
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
  // 1) Prefer auth admin lookup if available (SDK differences)
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

  // 2) Fallback to profiles table
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

function firstPriceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const priceId =
    (item as any)?.price?.id ||
    (item as any)?.plan?.id ||
    null;

  return priceId || null;
}

function entitlementsForStatus(
  priceId: string,
  status: Stripe.Subscription.Status
) {
  // If canceled/unpaid → treat as no access
  const inactive =
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired";

  if (inactive) return { pulse: false, recon: false, atlas: false };

  // Active-ish statuses:
  // active, trialing, past_due, incomplete, paused
  return entitlementsFromPrice(priceId);
}

/**
 * GET = proof endpoint exists in prod (browser-safe)
 * Does NOT run the sync.
 */
export async function GET() {
  return json(200, {
    ok: true,
    route: "api/admin/stripe-sync",
    version: "stripe-sync-v1",
    note: "Use POST with x-admin-token to run sync.",
    ts: new Date().toISOString(),
  });
}

/**
 * POST = Admin-only Stripe → Supabase sync
 * Purpose: repair/normalize entitlements + subscriptions for all users
 * so UI reflects their plan correctly (multi-user ready).
 *
 * Headers required:
 *  x-admin-token: <ADMIN_SYNC_TOKEN>
 *
 * Optional JSON body:
 *  { "limit": 50 }  // default 50, max 100
 */
export async function POST(req: Request) {
  // auth first
  const auth = requireAdmin(req);
  if (!auth.ok) return json(401, { ok: false, error: auth.error });

  const secretKey = mustEnv("STRIPE_SECRET_KEY");

  // We need service role to safely write
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const limitRaw = Number(body?.limit ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, limitRaw))
    : 50;

  try {
    // Pull recent subscriptions (status=all gets active + canceled)
    const subs = await stripe.subscriptions.list({
      limit,
      status: "all",
      expand: ["data.items.data.price", "data.customer"],
    });

    const results: Array<any> = [];
    let updatedEntitlements = 0;
    let updatedSubscriptions = 0;
    let skippedNoUser = 0;
    let skippedNoEmail = 0;
    let skippedNoPrice = 0;

    for (const sub of subs.data) {
      const subscriptionId = sub.id;
      const customerId = (sub.customer as any)?.id || (sub.customer as any) || null;

      // price → entitlements
      const priceId = firstPriceIdFromSubscription(sub);
      if (!priceId) {
        skippedNoPrice++;
        results.push({
          subscriptionId,
          customerId,
          ok: false,
          reason: "no_price_id",
        });
        continue;
      }

      // resolve email from customer (expanded) or retrieve
      let email: string | null = null;

      const expandedCustomer = sub.customer as any;
      if (expandedCustomer && typeof expandedCustomer === "object") {
        email = expandedCustomer.email || null;
      }

      if (!email && customerId) {
        try {
          const cust = await stripe.customers.retrieve(String(customerId));
          if (cust && typeof cust === "object") {
            email = (cust as any).email || null;
          }
        } catch {
          // ignore
        }
      }

      if (!email) {
        skippedNoEmail++;
        results.push({
          subscriptionId,
          customerId,
          priceId,
          ok: false,
          reason: "no_customer_email",
        });
        continue;
      }

      const userId = await resolveUserIdByEmail(supabaseAdmin, email);
      if (!userId) {
        skippedNoUser++;
        results.push({
          subscriptionId,
          customerId,
          priceId,
          email,
          ok: false,
          reason: "no_user_match_for_email",
        });
        continue;
      }

      const ent = entitlementsForStatus(priceId, sub.status);

      // 1) subscriptions table upsert (if exists)
      try {
        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            status: sub.status === "canceled" ? "canceled" : "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        );
        updatedSubscriptions++;
      } catch {
        // ignore (table may not exist / schema mismatch)
      }

      // 2) entitlements upsert (this is what drives UI)
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

      if (entErr) {
        results.push({
          subscriptionId,
          customerId,
          priceId,
          email,
          userId,
          ok: false,
          reason: "entitlements_upsert_failed",
          message: entErr?.message || String(entErr),
        });
        continue;
      }

      updatedEntitlements++;
      results.push({
        subscriptionId,
        customerId,
        priceId,
        email,
        userId,
        status: sub.status,
        entitlements: ent,
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
  } catch (err: any) {
    console.log("[stripe-sync] ERROR:", err?.message || err);
    return json(500, {
      ok: false,
      error: err?.message || "stripe_sync_failed",
    });
  }
}
