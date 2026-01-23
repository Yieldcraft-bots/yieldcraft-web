// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName = "", email = "" } = body || {};

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1️⃣ Create a Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      email,
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
      },
    });

    // 2️⃣ Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/affiliate`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/affiliate/success`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
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
