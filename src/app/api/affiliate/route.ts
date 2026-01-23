// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function isEmail(email: string) {
  // simple, practical check (good enough for intake)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBaseUrl(req: Request) {
  // Prefer your env, fall back to request host
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  if (envUrl) return envUrl.replace(/\/+$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function makeAffiliateCode() {
  // 10 hex chars = short + collision-resistant enough for now
  return crypto.randomBytes(5).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = safeStr(body?.fullName);
    const email = safeStr(body?.email).toLowerCase();

    if (!fullName || !email) {
      return jsonNoStore({ ok: false, error: "Missing fullName or email" }, 400);
    }
    if (!isEmail(email)) {
      return jsonNoStore({ ok: false, error: "Invalid email" }, 400);
    }

    const sb = supabaseAdmin();

    // 1) See if affiliate already exists for this email
    const existing = await sb
      .from("affiliates")
      .select("id,email,name,status,affiliate_code,commission_rate,created_at,approved_at")
      .eq("email", email)
      .maybeSingle();

    if (existing.error) {
      console.error("[affiliate] lookup error:", existing.error);
      return jsonNoStore({ ok: false, error: "DB lookup failed" }, 500);
    }

    let affiliate = existing.data;

    // 2) If missing, create a new affiliate record
    if (!affiliate) {
      // try a few times in case of rare affiliate_code collision
      let affiliateCode = makeAffiliateCode();
      let created = null;

      for (let i = 0; i < 5; i++) {
        const ins = await sb
          .from("affiliates")
          .insert({
            email,
            name: fullName,
            status: "pending",
            affiliate_code: affiliateCode,
            commission_rate: 30,
          })
          .select("id,email,name,status,affiliate_code,commission_rate,created_at,approved_at")
          .single();

        if (!ins.error) {
          created = ins.data;
          break;
        }

        // If unique constraint failed on affiliate_code, retry
        const msg = String(ins.error?.message || "");
        if (msg.toLowerCase().includes("affiliate_code") || msg.toLowerCase().includes("duplicate")) {
          affiliateCode = makeAffiliateCode();
          continue;
        }

        console.error("[affiliate] insert error:", ins.error);
        return jsonNoStore({ ok: false, error: "DB insert failed" }, 500);
      }

      if (!created) {
        return jsonNoStore({ ok: false, error: "Could not generate unique affiliate code" }, 500);
      }

      affiliate = created;
    } else {
      // 3) Keep name fresh if user re-applies (safe update)
      if (affiliate.name !== fullName) {
        const upd = await sb
          .from("affiliates")
          .update({ name: fullName })
          .eq("id", affiliate.id)
          .select("id,email,name,status,affiliate_code,commission_rate,created_at,approved_at")
          .single();

        if (!upd.error) affiliate = upd.data;
      }
    }

    const baseUrl = getBaseUrl(req);
    const affiliateCode = affiliate.affiliate_code;
    const affiliateLink = `${baseUrl}/?ref=${affiliateCode}`;

    // ✅ IMPORTANT:
    // Your UI likely expects `onboardingUrl`. For now we alias it to the affiliate link.
    // Next step: swap onboardingUrl to a real Stripe Connect account onboarding link.
    return jsonNoStore({
      ok: true,
      status: affiliate.status,
      commission_rate: affiliate.commission_rate ?? 30,
      affiliateCode,
      affiliateLink,
      onboardingUrl: affiliateLink,
    });
  } catch (err: any) {
    console.error("[affiliate] fatal:", err?.message || err);
    return jsonNoStore({ ok: false, error: "Unable to start affiliate onboarding." }, 500);
  }
}
