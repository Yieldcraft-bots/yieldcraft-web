// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";

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

    // Basic validation (safe + minimal)
    if (fullName.trim().length < 2 || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid submission" },
        { status: 400 }
      );
    }

    // 🔒 SAFE MODE:
    // No database writes
    // No external services
    // Just log for now (Vercel logs / email later if desired)
    console.log("AFFILIATE_APPLICATION", {
      fullName,
      email,
      audience,
      website,
      notes,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: "Application received",
    });
  } catch (err) {
    console.error("AFFILIATE_API_ERROR", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
