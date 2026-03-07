import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function getBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://yieldcraft.co"
  ).replace(/\/$/, "");
}

function genCode() {
  return Math.random().toString(16).slice(2, 10);
}

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripe;
}

function safeEmail(v: any) {
  const s = String(v || "").trim().toLowerCase();
  if (!s || !s.includes("@")) return "";
  return s;
}

async function sendAffiliateEmails(args: {
  to: string;
  name: string;
  affiliateLink: string;
  onboardingUrl?: string | null;
}) {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const from = "YieldCraft <dk@yieldcraft.co>";

  const { to, name, affiliateLink, onboardingUrl } = args;

  const subjectUser = "Your YieldCraft affiliate link is ready ✅";
  const htmlUser = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.55; color:#0f172a;">
      <h2 style="margin:0 0 10px;">Affiliate application received ✅</h2>
      <p style="margin:0 0 12px;">${name ? `Hey ${name}, ` : ""}your referral link is ready:</p>
      <div style="padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; margin:0 0 14px;">
        <div style="font-weight:700; margin-bottom:6px;">Your referral link</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:12px; word-break:break-all;">
          ${affiliateLink}
        </div>
      </div>
      ${
        onboardingUrl
          ? `<a href="${onboardingUrl}" style="display:inline-block; padding:10px 14px; background:#111827; color:white; text-decoration:none; border-radius:10px; font-weight:700;">
              Finish Stripe payout setup
            </a>`
          : `<div style="padding:12px 14px; border-left:4px solid #f59e0b; background:#fff7ed; border-radius:10px;">
              <strong>Payout setup pending:</strong> We couldn’t generate your Stripe onboarding link yet. Your referral link is still valid.
            </div>`
      }
      <p style="margin:14px 0 0; font-size:12px; color:#64748b;">
        Keep it compliant: no spam, no guarantees, no misleading performance claims.
      </p>
    </div>
  `;

  const subjectAdmin = "New affiliate application (YieldCraft)";
  const htmlAdmin = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.55; color:#0f172a;">
      <h3 style="margin:0 0 10px;">New affiliate application</h3>
      <p style="margin:0 0 6px;"><strong>Name:</strong> ${name || "(none)"}</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${to}</p>
      <p style="margin:0 0 6px;"><strong>Referral:</strong> ${affiliateLink}</p>
      <p style="margin:0 0 6px;"><strong>Onboarding:</strong> ${onboardingUrl || "(none)"}</p>
    </div>
  `;

  const adminTo = (process.env.AFFILIATE_ADMIN_EMAILS || "dk@yieldcraft.co")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const userSend = await resend.emails.send({
    from,
    to: [to],
    subject: subjectUser,
    html: htmlUser,
  });

  const adminSend = await resend.emails.send({
    from,
    to: adminTo,
    subject: subjectAdmin,
    html: htmlAdmin,
  });

  return { userSend, adminSend };
}

export async function POST(req: Request) {
  try {
    const stripe = await getStripe();

    const body = await req.json().catch(() => ({}));
    const fullName = String(body?.fullName || "").trim();
    const email = safeEmail(body?.email);

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

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!supabaseUrl) throw new Error("Missing env: SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data: existing, error: existingErr } = await sb
      .from("affiliates")
      .select(
        "id,email,name,status,affiliate_code,commission_rate,stripe_account_id"
      )
      .eq("email", email)
      .maybeSingle();

    if (existingErr) throw existingErr;

    let stripeAccountId = (existing?.stripe_account_id as string | null) || null;

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

    const affiliateCode = existing?.affiliate_code || genCode();

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

    if (existing?.id) {
      const { error: upErr } = await sb
        .from("affiliates")
        .update(payload)
        .eq("id", existing.id);

      if (upErr) {
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

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/affiliate?refresh=1`,
      return_url: `${baseUrl}/affiliate/success?code=${encodeURIComponent(
        affiliateCode
      )}`,
      type: "account_onboarding",
    });

    const affiliateLink = `${baseUrl}/pricing?ref=${affiliateCode}`;

    let emailStatus: any = { ok: false };
    try {
      const sent = await sendAffiliateEmails({
        to: email,
        name: fullName,
        affiliateLink,
        onboardingUrl: accountLink.url,
      });
      emailStatus = { ok: true, sent };
    } catch (e: any) {
      emailStatus = { ok: false, error: e?.message || String(e) };
    }

    return NextResponse.json({
      ok: true,
      status: existing?.status || "pending",
      commission_rate: existing?.commission_rate ?? 30,
      affiliateCode,
      affiliateLink,
      onboardingUrl: accountLink.url,
      stripeAccountId,
      emailStatus,
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

export async function GET() {
  return NextResponse.json({ ok: true });
}