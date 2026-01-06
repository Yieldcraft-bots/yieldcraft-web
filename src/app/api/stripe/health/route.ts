// src/app/api/stripe/health/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasPublishable = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  // Never return actual keys; only return presence + mode hint.
  const secretPrefix = (process.env.STRIPE_SECRET_KEY || "").slice(0, 8); // "sk_live_" or "sk_test_"
  const mode =
    secretPrefix.startsWith("sk_live_")
      ? "live"
      : secretPrefix.startsWith("sk_test_")
      ? "test"
      : "unknown";

  return NextResponse.json(
    {
      ok: hasSecret && hasPublishable,
      hasSecret,
      hasPublishable,
      mode,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
