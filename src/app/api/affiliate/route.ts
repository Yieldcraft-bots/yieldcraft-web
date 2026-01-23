// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

// ✅ Use the Stripe SDK’s pinned API version (or set it to the one your SDK expects)
// Easiest + safest: DO NOT set apiVersion at all.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // apiVersion: "2025-12-15.clover", // optional: only if you want to pin explicitly
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName = "", email = "" } = body || {};

    if (!fullName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1) Create a Stripe Connect Express account for the affiliate
    const account = await stripe.accounts.create({
      type: "express",
      email,
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
      },
    });

    // 2) Create onboarding link
    // NOTE: You set NEXT_PUBLIC_APP_URL in Vercel — this uses it.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Missing env: NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/affiliate`,
      return_url: `${baseUrl}/affiliate/success`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
    });
  } catch (err) {
    console.error("Affiliate onboarding error:", err);
    return NextResponse.json(
      { error: "Unable to start affiliate onboarding." },
      { status: 500 }
    );
  }
}
