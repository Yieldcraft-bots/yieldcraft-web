// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fullName = "",
      email = "",
      audience = "",
      website = "",
      notes = "",
    } = body || {};

    // Minimal validation (never throw hard)
    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 🔒 SAFE MODE:
    // For now, we just log the application.
    // No DB, no email, no Stripe — nothing that can break.
    console.log("📩 Affiliate application received:", {
      fullName,
      email,
      audience,
      website,
      notes,
      at: new Date().toISOString(),
    });

    // Always return success so frontend is happy
    return NextResponse.json({
      ok: true,
      message: "Application received. We’ll email you shortly.",
    });
  } catch (err) {
    console.error("Affiliate apply error:", err);

    return NextResponse.json(
      { error: "Unable to process application right now." },
      { status: 500 }
    );
  }
}
