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
 * GET = DEPLOYMENT PROOF CHECK
 */
export async function GET() {
  return json(200, {
    ok: true,
    route: "api/admin/stripe-sync",
    version: "stripe-sync-v4_auth_listusers_email_match",
    note: "Use POST with x-admin-token to run sync.",
    ts: new Date().toISOString(),
  });
}

/**
 * Price → entitlements mapping (same envs as webhook)
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

function normEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

/**
 * ✅ Robust user lookup:
 * - Try getUserByEmail if the SDK supports it
 * - Otherwise use auth.admin.listUsers() and match email case-insensitively
 */
async function resolveUserIdByEmail(supabaseAdmin: any, email: string) {
  const target = normEmail(email);
  if (!target) return null;

  // 1) Prefer getUserByEmail when available
  try {
    const admin = supabaseAdmin.auth?.admin as any;
    if (admin?.getUserByEmail) {
      const res = await admin.getUserByEmail(email);
      const user = res?.data?.user;
      if (user?.id) return user.id as string;
    }
  } catch {
    // fall through
  }

  // 2) Fallback: listUsers and match (works reliably)
  try {
    const admin = supabaseAdmin.auth?.admin as any;
    if (!admin?.listUsers) return null;

    // your userbase is small right now; scan up to 10 pages x 1000 = 10k users max
    for (let page = 1; page <= 10; page++) {
      const res = await admin.listUsers({ page, perPage: 1000 });
      const users = res?.data?.users || [];
      for (const u of users) {
        if (normEmail(u?.email || "") === target) return u.id as string;
      }
      if (users.length < 1000) break; // no more pages
    }
  } catch {
    // ignore
  }

  return null;
}

async function getCustomerEmail(stripe: Stripe, customer: any): Promise<string | null> {
  if (!customer) return null;

  // expanded customer object
  if (typeof customer === "object" && customer.email) return customer.email as string;

  // customer id string
  if (typeof customer === "string") {
    try {
      const c = await stripe.customers.retrieve(customer);
      if (typeof c === "object" && (c as any).email) return (c as any).email as string;
    } catch {
      return null;
    }
  }

  return null;
}

function getPriceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const firstItem = sub.items?.data?.[0];
  const price = (firstItem as any)?.price;
  return price?.id || null;
}

export async function POST(req: Request) {
  // Admin protection
  const expected = mustEnv("ADMIN_SYNC_TOKEN");
  const got = req.headers.get("x-admin-token") || "";
  if (got !== expected) return json(401, { ok: false, error: "unauthorized" });

  const secretKey = mustEnv("STRIPE_SECRET_KEY");

  // Supabase service role for writes + admin user lookup
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

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "50")));

  const counts = {
    fetched: 0,
    updatedEntitlements: 0,
    updatedSubscriptions: 0,
    skippedNoEmail: 0,
    skippedNoUser: 0,
    skippedNoPrice: 0,
  };

  const results: any[] = [];

  // Pull subscriptions
  const list = await stripe.subscriptions.list({
    limit,
    status: "all",
    expand: ["data.customer", "data.items.data.price"],
  });

  counts.fetched = list.data.length;

  for (const sub of list.data) {
    const subscriptionId = sub.id;
    const customerId = (sub.customer as any) || null;
    const priceId = getPriceIdFromSubscription(sub);

    if (!priceId) {
      counts.skippedNoPrice++;
      results.push({ subscriptionId, customerId, ok: false, reason: "no_price" });
      continue;
    }

    const email = await getCustomerEmail(stripe, sub.customer as any);
    if (!email) {
      counts.skippedNoEmail++;
      results.push({ subscriptionId, customerId, priceId, ok: false, reason: "no_email" });
      continue;
    }

    const userId = await resolveUserIdByEmail(supabaseAdmin, email);
    if (!userId) {
      counts.skippedNoUser++;
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

    const ent = entitlementsFromPrice(priceId);

    // 1) Upsert entitlements (idempotent)
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

    // 2) Upsert subscriptions (idempotent)
    try {
      const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: typeof customerId === "string" ? customerId : null,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          status: sub.status || "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
      if (!subErr) counts.updatedSubscriptions++;
    } catch {
      // ignore
    }

    results.push({
      subscriptionId,
      customerId: typeof customerId === "string" ? customerId : null,
      priceId,
      email,
      userId,
      entitlements: ent,
      ok: true,
    });
  }

  return json(200, {
    ok: true,
    ran: true,
    limit,
    counts,
    results,
  });
}
