// src/app/api/affiliate/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Env vars used (set in Vercel):
 * - RESEND_API_KEY (already in your project)
 * - AFFILIATE_NOTIFY_EMAIL (where YOU receive applications)
 * Optional:
 * - AFFILIATE_FROM_EMAIL (must be a Resend-verified sender, e.g. "YieldCraft <support@yieldcraft.co>")
 * - AFFILIATE_SEND_CONFIRMATION ("true"|"false") default true
 */

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function getEnv(name: string, fallback: string) {
  const v = process.env[name];
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : fallback;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendResendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}) {
  const apiKey = mustEnv("RESEND_API_KEY");

  const from = getEnv(
    "AFFILIATE_FROM_EMAIL",
    // NOTE: this must be a verified sender in Resend or it will fail.
    // We'll set this properly in the next step.
    "YieldCraft <no-reply@yieldcraft.co>"
  );

  const payload: any = {
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
  };

  if (args.reply_to) payload.reply_to = args.reply_to;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${text || "unknown error"}`);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fullName = String(body?.fullName ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const audience = String(body?.audience ?? "").trim();
    const website = String(body?.website ?? "").trim();
    const notes = String(body?.notes ?? "").trim();

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    // 1) Notify YOU
    const notifyTo = mustEnv("AFFILIATE_NOTIFY_EMAIL");

    const adminHtml = `
      <div style="font-family: ui-sans-serif, system-ui; line-height:1.4">
        <h2>New YieldCraft Affiliate Application</h2>
        <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Audience / Channel:</strong><br/>${nl2br(escapeHtml(audience || "—"))}</p>
        <p><strong>Website:</strong> ${escapeHtml(website || "—")}</p>
        <p><strong>Notes:</strong><br/>${nl2br(escapeHtml(notes || "—"))}</p>
        <hr />
        <p style="color:#6b7280; font-size:12px">Sent from /api/affiliate</p>
      </div>
    `;

    await sendResendEmail({
      to: notifyTo,
      subject: `New Affiliate Application — ${fullName}`,
      html: adminHtml,
      reply_to: email, // easy reply back
    });

    // 2) Optional confirmation to applicant
    const sendConfirmation =
      getEnv("AFFILIATE_SEND_CONFIRMATION", "true").toLowerCase() !== "false";

    if (sendConfirmation) {
      const applicantHtml = `
        <div style="font-family: ui-sans-serif, system-ui; line-height:1.5">
          <h2>We got your affiliate application ✅</h2>
          <p>Hey ${escapeHtml(firstName(fullName))},</p>
          <p>
            Thanks for applying to the YieldCraft Affiliate Program.
            We review applications manually to keep quality high.
          </p>
          <p>
            <strong>Next:</strong> if approved, you’ll receive your referral link + payout details by email.
          </p>
          <p style="margin-top:18px; color:#6b7280; font-size:12px">
            If you didn’t submit this, you can ignore this email.
          </p>
        </div>
      `;

      await sendResendEmail({
        to: email,
        subject: "YieldCraft Affiliate Application Received",
        html: applicantHtml,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    // IMPORTANT: We do not leak secrets. Only return a generic error.
    console.error("affiliate POST error:", err?.message || err);
    return NextResponse.json(
      { error: "Unable to process application right now." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

/* -------- helpers -------- */

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(s: string) {
  return s.replace(/\n/g, "<br/>");
}

function firstName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || "there";
}
