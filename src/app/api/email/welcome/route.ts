import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  try {
    const apiKey = requireEnv("RESEND_API_KEY");
    const resend = new Resend(apiKey);

    // optional JSON body: { "to": "email@domain.com", "name": "Donnie" }
    let to = "dk@yieldcraft.co";
    let name = "";
    try {
      const body = await req.json();
      if (body?.to && typeof body.to === "string") to = body.to;
      if (body?.name && typeof body.name === "string") name = body.name;
    } catch {
      // ignore if no JSON body
    }

    const from = "YieldCraft <dk@yieldcraft.co>";
    const safeName = name ? escapeHtml(name) : "";

    const subject = "Welcome to YieldCraft ✅";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin:0 0 10px;">Welcome to YieldCraft ✅</h2>
        <p style="margin:0 0 12px;">
          ${safeName ? `Hey ${safeName}, ` : ""}you’re in.
          YieldCraft is built for <strong>safe, disciplined execution</strong> — not hype.
        </p>

        <div style="padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; margin:0 0 14px;">
          <strong>Minimum account guidance</strong>
          <div style="margin-top:6px;">
            We recommend starting with at least <strong>$50</strong> so the system can operate normally with fees + sizing.
          </div>
        </div>

        <p style="margin:0 0 10px;"><strong>Your next steps:</strong></p>
        <ol style="margin:0 0 14px; padding-left:18px;">
          <li><strong>Connect Coinbase</strong> and make sure your status is green.</li>
          <li>Start small, stay consistent. The goal is repeatable behavior, not adrenaline.</li>
          <li>Watch the logs: we show <em>why</em> a trade did or didn’t fire.</li>
        </ol>

        <div style="padding:12px 14px; border-left:4px solid #0ea5e9; background:#ecfeff; border-radius:10px; margin:0 0 14px;">
          <strong>About “No trade”</strong><br/>
          Skipping trades is not failure — it’s risk control.
          If conditions aren’t clean, the safest move is to do nothing and wait for a better setup.
        </div>

        <p style="margin:0 0 10px;">
          Want a quick start? Visit: <a href="https://yieldcraft.co/quick-start">yieldcraft.co/quick-start</a>
        </p>

        <p style="margin:14px 0 0; font-size:12px; color:#64748b;">
          You’re receiving this because you signed up for YieldCraft.
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    });

    return NextResponse.json({ ok: true, to, result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
