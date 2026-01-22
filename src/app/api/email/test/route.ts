import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Missing RESEND_API_KEY");

    const resend = new Resend(apiKey);

    const from =
      process.env.RESEND_FROM_EMAIL || "YieldCraft <onboarding@resend.dev>";
    const to = ["dk@yieldcraft.co"];

    const result = await resend.emails.send({
      from,
      to,
      subject: "YieldCraft API Route Test ✅",
      html: `
        <h2>Route works ✅</h2>
        <p>This email was sent from <strong>/api/email/test</strong>.</p>
      `,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
