// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function safeEmail(input: unknown) {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function safeText(input: unknown, max = 200) {
  return String(input || "")
    .trim()
    .slice(0, max);
}

function genAffiliateCode() {
  // short, URL-friendly, reasonably unique
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = safeText((body as any)?.fullName, 120);
    const email = safeEmail((body as any)?.email);

    if (!fullName || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields (fullName, email)" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sb = supabaseAdmin();

    // 1) If affiliate already exists, return their existing code/link (no duplicates)
    const { data: existing, error: selErr } = await sb
      .from("affiliates")
      .select("id, affiliate_code, status, commission_rate")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { ok: false, error: `DB read failed: ${selErr.message}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const appUrl =
      (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "") ||
      "https://yieldcraft.co";

    if (existing?.affiliate_code) {
      return NextResponse.json(
        {
          ok: true,
          status: existing.status,
          commission_rate: existing.commission_rate,
          affiliateCode: existing.affiliate_code,
          affiliateLink: `${appUrl}/?ref=${encodeURIComponent(
            existing.affiliate_code
          )}`,
          message:
            existing.status === "approved"
              ? "Affiliate already approved."
              : "Application already received.",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) Create new affiliate (pending) + generate unique code
    let affiliateCode = genAffiliateCode();

    // try a few times in the (rare) case of a collision on unique(affiliate_code)
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { data: inserted, error: insErr } = await sb
        .from("affiliates")
        .insert({
          email,
          name: fullName,
          status: "pending",
          affiliate_code: affiliateCode,
          commission_rate: 30,
        })
        .select("id, affiliate_code, status, commission_rate")
        .single();

      if (!insErr && inserted?.affiliate_code) {
        return NextResponse.json(
          {
            ok: true,
            status: inserted.status,
            commission_rate: inserted.commission_rate,
            affiliateCode: inserted.affiliate_code,
            affiliateLink: `${appUrl}/?ref=${encodeURIComponent(
              inserted.affiliate_code
            )}`,
            message: "Application received.",
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      // If email already exists (unique violation), fetch and return it
      if (insErr?.message?.toLowerCase().includes("affiliates_email_key")) {
        const { data: again } = await sb
          .from("affiliates")
          .select("affiliate_code, status, commission_rate")
          .eq("email", email)
          .maybeSingle();

        if (again?.affiliate_code) {
          return NextResponse.json(
            {
              ok: true,
              status: again.status,
              commission_rate: again.commission_rate,
              affiliateCode: again.affiliate_code,
              affiliateLink: `${appUrl}/?ref=${encodeURIComponent(
                again.affiliate_code
              )}`,
              message:
                again.status === "approved"
                  ? "Affiliate already approved."
                  : "Application already received.",
            },
            { headers: { "Cache-Control": "no-store" } }
          );
        }
      }

      // If code collided, generate a new one and retry
      if (
        insErr?.message?.toLowerCase().includes("affiliates_affiliate_code_key") ||
        insErr?.message?.toLowerCase().includes("duplicate key")
      ) {
        affiliateCode = genAffiliateCode();
        continue;
      }

      return NextResponse.json(
        { ok: false, error: `DB insert failed: ${insErr?.message || "unknown"}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to generate a unique affiliate code. Try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[affiliate.apply] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unable to submit affiliate application." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
