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

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

async function resolveUserIdByEmail(supabaseAdmin: any, emailRaw: string) {
  const email = normEmail(emailRaw);

  // 1) Try Supabase Auth Admin (if available in this SDK)
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

  // 2) Try public.users (YOUR project has this table)
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .ilike("email", email)
      .maybeSingle();

    if (!error && data?.id) return data.id as string;
  } catch {
    // ignore
  }

  // 3) Try profiles.email (common pattern)
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email")
      .ilike("email", email)
      .maybeSingle();

    if (!error && data?.id) return data.id as string;
  } catch {
    // ignore
  }

  return null;
}

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

async function getSubscriptionPriceId(stripe: Stripe, subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const firstItem = sub.items?.data?.[0];
  const price = (firstItem as any)?.price;
  return price?.id || null;
}

export async function GET() {
  return json(200, {
    ok: true,
    route: "api/admin/stripe-sync",
    version: "stripe-sync-v2_user_lookup_fix",
    note: "Use POST with x-admin-token to run sync.",
    ts: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const adminToken = mustEnv("ADMIN_SYNC_TOKEN");
  const got = req.headers.get("x-admin-token");
  if (!got || got !== adminToken) return json(401, { ok: false, error: "Unauthorized" });

  const secretKey = mustEnv("STRIPE_SECRET_KEY");
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const stripe = new Stripe(secretKey, { apiVersion: "2025-06-30.basil" as any });
  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || "50");

  const counts = {
    fetched: 0,
    updatedEntitlements: 0,
    updatedSubscriptions: 0,
    skippedNoEmail: 0,
    skippedNoUser: 0,
    skippedNoPrice: 0,
  };

  const results: any[] = [];

  const subs = await stripe.subscriptions.list({
    limit: Math.max(1, Math.min(100, limit)),
    status: "all",
    expand: ["data.items.data.price", "data.customer"],
  });

  counts.fetched = subs.data.length;

  for (const sub of subs.data) {
    const subscriptionId = sub.id;
    const customerId = (sub.customer as any)?.id || (sub.customer as any) || null;

    // Try email from customer expansion first
    let email: string | null = null;
    const cust = sub.customer as any;
    if (cust?.email) email = cust.email;

    // Fallback: retrieve customer if missing
    if (!email && customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        email = (c as any)?.email || null;
      } catch {
        // ignore
      }
    }

    if (!email) {
      counts.skippedNoEmail++;
      results.push({ subscriptionId, customerId, ok: false, reason: "no_email" });
      continue;
    }

    const priceId =
      (sub.items?.data?.[0] as any)?.price?.id ||
      (await getSubscriptionPriceId(stripe, subscriptionId));

    if (!priceId) {
      counts.skippedNoPrice++;
      results.push({ subscriptionId, customerId, email, ok: false, reason: "no_price" });
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

    try {
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          status: sub.status || "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
      counts.updatedSubscriptions++;
    } catch {
      // ignore
    }

    results.push({
      subscriptionId,
      customerId,
      priceId,
      email,
      userId,
      ok: true,
      entitlements: ent,
    });
  }

  return json(200, { ok: true, ran: true, limit, counts, results });
}
