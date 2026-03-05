import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanEmail(input: unknown, fallback: string) {
  if (typeof input !== "string") return fallback;
  const v = input.trim();
  if (!v) return fallback;
  if (!v.includes("@") || v.length > 254) return fallback;
  return v;
}

function splitEmails(v: string): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const apiKey = requireEnv("RESEND_API_KEY");
    const resend = new Resend(apiKey);

    const body = await req.json().catch(() => ({} as any));

    const to = cleanEmail(body?.to, "");
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const affiliateLink =
      typeof body?.affiliateLink === "string" ? body.affiliateLink.trim() : "";
    const onboardingUrl =
      typeof body?.onboardingUrl === "string" ? body.onboardingUrl.trim() : "";

    // Admin emails: optional env, defaults to dk@yieldcraft.co
    const adminList = splitEmails(process.env.AFFILIATE_ADMIN_EMAILS || "");
    const adminTo = adminList.length ? adminList : ["dk@yieldcraft.co"];

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing to email" },
        { status: 400 }
      );
    }

    const from = "YieldCraft <dk@yieldcraft.co>";

    // 1) Applicant confirmation
    const safeName = name ? escapeHtml(name) : "";
    const safeAffiliateLink = escapeHtml(affiliateLink);
    const safeOnboardingUrl = escapeHtml(onboardingUrl);

    const subjectUser = "Your YieldCraft affiliate link is ready ✅";

    const htmlUser = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.55; color:#0f172a;">
        <h2 style="margin:0 0 10px;">Affiliate application received ✅</h2>

        <p style="margin:0 0 12px;">
          ${safeName ? `Hey ${safeName}, ` : ""}your referral link is ready.
        </p>

        <div style="padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; margin:0 0 14px;">
          <div style="font-weight:700; margin-bottom:6px;">Your referral link</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:12px; word-break:break-all;">
            ${safeAffiliateLink || "(missing)"}
          </div>
        </div>

        ${
          onboardingUrl
            ? `
          <div style="margin:0 0 14px;">
            <a href="${safeOnboardingUrl}" style="display:inline-block; padding:10px 14px; background:#111827; color:white; text-decoration:none; border-radius:10px; font-weight:700;">
              Finish Stripe payout setup
            </a>
          </div>
        `
            : `
          <div style="padding:12px 14px; border-left:4px solid #f59e0b; background:#fff7ed; border-radius:10px; margin:0 0 14px;">
            <strong>Payout setup pending:</strong> We couldn’t generate your Stripe onboarding link yet.
            Your referral link is still valid — we’ll follow up if needed.
          </div>
        `
        }

        <p style="margin:0 0 10px; font-size:12px; color:#64748b;">
          Keep it compliant: no spam, no guarantees, no misleading performance claims.
        </p>
      </div>
    `;

    const userSend = await resend.emails.send({
      from,
      to: [to],
      subject: subjectUser,
      html: htmlUser,
    });

    // 2) Admin notification (you)
    const subjectAdmin = "New affiliate application (YieldCraft)";
    const htmlAdmin = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.55; color:#0f172a;">
        <h3 style="margin:0 0 10px;">New affiliate application</h3>
        <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(name || "(none)")}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(to)}</p>
        <p style="margin:0 0 6px;"><strong>Referral:</strong> ${escapeHtml(affiliateLink || "(none)")}</p>
        <p style="margin:0 0 6px;"><strong>Onboarding:</strong> ${escapeHtml(onboardingUrl || "(none)")}</p>
      </div>
    `;

    const adminSend = await resend.emails.send({
      from,
      to: adminTo,
      subject: subjectAdmin,
      html: htmlAdmin,
    });

    return NextResponse.json({
      ok: true,
      sent: { user: true, admin: true },
      userSend,
      adminSend,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}