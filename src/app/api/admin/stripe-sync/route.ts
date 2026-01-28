import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST() {
  try {
    const stripe = new Stripe(mustEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-06-30.basil" as any,
    });

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const PULSE_STARTER = process.env.STRIPE_PRICE_PULSE_STARTER || "";
    const PULSE_RECON = process.env.STRIPE_PRICE_PULSE_RECON || "";
    const ATLAS = process.env.STRIPE_PRICE_ATLAS || "";
    const PRO = process.env.STRIPE_PRICE_PRO_SUITE || "";

    const subs = await stripe.subscriptions.list({
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
      limit: 100,
    });

    let updated = 0;

    for (const sub of subs.data) {
      const customer = sub.customer as Stripe.Customer;
      const email = customer?.email;
      if (!email) continue;

      const priceId = sub.items.data[0]?.price?.id;
      if (!priceId) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!profile?.id) continue;

      let pulse = false;
      let recon = false;
      let atlas = false;

      if (priceId === PULSE_STARTER) pulse = true;
      if (priceId === PULSE_RECON) { pulse = true; recon = true; }
      if (priceId === ATLAS) atlas = true;
      if (priceId === PRO) { pulse = true; recon = true; atlas = true; }

      await supabase.from("entitlements").upsert(
        {
          user_id: profile.id,
          pulse,
          recon,
          atlas,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await supabase.from("subscriptions").upsert(
        {
          user_id: profile.id,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          status: sub.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );

      updated++;
    }

    return NextResponse.json({ ok: true, synced: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
