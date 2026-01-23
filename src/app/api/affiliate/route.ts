import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function getBaseUrl() {
  // prefer server-only, but allow your existing public var too
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://yieldcraft.co"
  ).replace(/\/$/, "");
}

function genCode() {
  // short, human-safe-ish code
  return Math.random().toString(16).slice(2, 10);
}

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    const audience = String(body?.audience || body?.channel || "").trim();
    const website = String(body?.website || "").trim();
    const notes = String(body?.notes || "").trim();

    if (!fullName || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // Supabase (service role - server only)
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!supabaseUrl) throw new Error("Missing env: SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // 1) Find existing affiliate by email (if they applied before)
    const { data: existing, error: existingErr } = await sb
      .from("affiliates")
      .select("id,email,name,status,affiliate_code,commission_rate,stripe_account_id")
      .eq("email", email)
      .maybeSingle();

    if (existingErr) throw existingErr;

    // 2) Ensure Stripe Connect Express account exists
    let stripeAccountId = existing?.stripe_account_id as string | null;

    if (!stripeAccountId) {
      const acct = await stripe.accounts.create({
        type: "express",
        email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          source: "yieldcraft_affiliate_apply",
        },
      });
      stripeAccountId = acct.id;
    }

    // 3) Ensure affiliate_code exists
    const affiliateCode = existing?.affiliate_code || genCode();

    // 4) Upsert affiliate row
    // NOTE: your table currently includes: email, name, status, affiliate_code, commission_rate, created_at, approved_at
    // We also store stripe_account_id + optional fields if your table has them.
    // If your table doesn't yet have these extra columns, it will still work if we only write known columns.
    const payload: any = {
      email,
      name: fullName,
      status: existing?.status || "pending",
      affiliate_code: affiliateCode,
      commission_rate: existing?.commission_rate ?? 30,
      stripe_account_id: stripeAccountId,
      audience,
      website,
      notes,
    };

    // Try update if exists, else insert
    if (existing?.id) {
      const { error: upErr } = await sb
        .from("affiliates")
        .update(payload)
        .eq("id", existing.id);
      if (upErr) {
        // fallback: update only core columns if extra cols don't exist
        const { error: upErr2 } = await sb
          .from("affiliates")
          .update({
            email,
            name: fullName,
            status: existing?.status || "pending",
            affiliate_code: affiliateCode,
            commission_rate: existing?.commission_rate ?? 30,
          })
          .eq("id", existing.id);
        if (upErr2) throw upErr2;
      }
    } else {
      const { error: insErr } = await sb.from("affiliates").insert([
        {
          email,
          name: fullName,
          status: "pending",
          affiliate_code: affiliateCode,
          commission_rate: 30,
          stripe_account_id: stripeAccountId,
          audience,
          website,
          notes,
        },
      ]);

      if (insErr) {
        // fallback: insert only core columns if extra cols don't exist
        const { error: insErr2 } = await sb.from("affiliates").insert([
          {
            email,
            name: fullName,
            status: "pending",
            affiliate_code: affiliateCode,
            commission_rate: 30,
          },
        ]);
        if (insErr2) throw insErr2;
      }
    }

    // 5) Create Stripe onboarding link (this is what your UI should redirect to)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/affiliate?refresh=1`,
      return_url: `${baseUrl}/affiliate/success?code=${encodeURIComponent(affiliateCode)}`,
      type: "account_onboarding",
    });

    const affiliateLink = `${baseUrl}/?ref=${affiliateCode}`;

    return NextResponse.json({
      ok: true,
      status: existing?.status || "pending",
      commission_rate: existing?.commission_rate ?? 30,
      affiliateCode,
      affiliateLink,
      onboardingUrl: accountLink.url, // ✅ KEY FIX
      stripeAccountId,
    });
  } catch (err: any) {
    console.error("Affiliate onboarding error:", err?.message || err);
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to start affiliate onboarding.",
        detail: err?.message || "unknown_error",
      },
      { status: 500 }
    );
  }
}
