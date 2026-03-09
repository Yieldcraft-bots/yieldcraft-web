import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Missing subscriptionId" },
        { status: 400 }
      );
    }

    const canceled = await stripe.subscriptions.cancel(subscriptionId);

    return NextResponse.json({
      ok: true,
      subscription: canceled.id,
      status: canceled.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Cancel failed" },
      { status: 500 }
    );
  }
}