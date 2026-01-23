"use client";

import { useMemo, useState, type FormEvent } from "react";

type ApplyState =
  | { status: "idle" }
  | { status: "submitting" }
  | {
      status: "success";
      affiliateCode: string;
      affiliateLink: string;
      onboardingUrl?: string | null;
      message?: string;
    }
  | { status: "error"; message: string; details?: string };

function normalizeEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

export default function AffiliatePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);

  const [applyState, setApplyState] = useState<ApplyState>({ status: "idle" });

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      normalizeEmail(email).includes("@") &&
      agree &&
      applyState.status !== "submitting"
    );
  }, [fullName, email, agree, applyState.status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setApplyState({ status: "submitting" });

    try {
      const payload = {
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        audience: audience.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // leave data null
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          `Affiliate request failed (HTTP ${res.status})`;
        setApplyState({
          status: "error",
          message: msg,
          details: typeof text === "string" ? text.slice(0, 500) : undefined,
        });
        return;
      }

      // Expected shapes we support:
      // A) { ok:true, affiliateCode, affiliateLink, onboardingUrl? }
      // B) { ok:true, status:'pending', commission_rate, affiliateCode, affiliateLink, onboardingUrl? }
      const ok = Boolean(data?.ok);
      const affiliateCode = String(data?.affiliateCode || data?.affiliate_code || "");
      const affiliateLink = String(data?.affiliateLink || data?.affiliate_link || "");
      const onboardingUrl = (data?.onboardingUrl || data?.onboarding_url || null) as
        | string
        | null;

      if (!ok || !affiliateCode || !affiliateLink) {
        setApplyState({
          status: "error",
          message:
            "Affiliate service responded, but did not return your referral link. Check /api/affiliate response in Vercel logs.",
          details: JSON.stringify(data ?? {}, null, 2).slice(0, 500),
        });
        return;
      }

      setApplyState({
        status: "success",
        affiliateCode,
        affiliateLink,
        onboardingUrl,
        message:
          data?.message ||
          "Application received. Your referral link is ready.",
      });
    } catch (err: any) {
      setApplyState({
        status: "error",
        message: "Unable to start affiliate onboarding.",
        details: err?.message ? String(err.message) : undefined,
      });
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <main className="min-h-screen bg-[#050B16] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight">
            Affiliate <span className="text-[#ffcf33]">Program</span>
          </h1>

          {/* ✅ copy fixed here */}
          <p className="mt-4 text-lg text-white/80">
            Earn <span className="font-bold text-[#ffcf33]">30% recurring</span>{" "}
            when you refer new members to YieldCraft.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-2">
          {/* Left: value props */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">What you get</h2>
            <ul className="mt-4 space-y-2 text-white/80">
              <li>• Tracked attribution</li>
              <li>• Automated Stripe payouts (after approval)</li>
              <li>• Promo assets + tracking links</li>
              <li>• Partner updates (email)</li>
            </ul>

            <div className="mt-6 rounded-xl border border-[#ffcf33]/30 bg-[#ffcf33]/10 p-4 text-sm text-white/90">
              Pro tip: “Audience / channel” helps us approve faster and send the
              right assets.
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/75">
              <div className="font-semibold text-white mb-2">
                Strict rules (keeps you + YieldCraft protected):
              </div>
              <ul className="space-y-1">
                <li>• No spam / unsolicited messaging</li>
                <li>• No misleading claims (especially performance)</li>
                <li>• No brand-bidding ads on YieldCraft terms</li>
                <li>• No “guarantees,” no impersonation, no fake testimonials</li>
              </ul>
              <div className="mt-3">
                Full terms:{" "}
                <a
                  className="text-[#ffcf33] underline"
                  href="/affiliate/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  Affiliate Terms &amp; Compliance
                </a>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#ffcf33]/60"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#ffcf33]/60"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#ffcf33]/60"
                placeholder="Audience / channel (optional)"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />

              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#ffcf33]/60"
                placeholder="Website (optional)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              <textarea
                className="min-h-[140px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#ffcf33]/60"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <label className="flex items-start gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#ffcf33]"
                />
                <span>
                  I agree to the{" "}
                  <a
                    className="text-[#ffcf33] underline"
                    href="/affiliate/terms"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Affiliate Terms
                  </a>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-xl bg-[#ffcf33] px-4 py-3 font-bold text-black disabled:opacity-60"
              >
                {applyState.status === "submitting" ? "Submitting..." : "Apply"}
              </button>

              {/* Status */}
              {applyState.status === "error" && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  <div className="font-semibold">{applyState.message}</div>
                  {applyState.details ? (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-200/80">
                      {applyState.details}
                    </pre>
                  ) : null}
                </div>
              )}

              {applyState.status === "success" && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  <div className="font-semibold">
                    {applyState.message || "Application received."}
                  </div>

                  <div className="mt-3">
                    <div className="text-white/70 text-xs">Your referral link</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/90">
                        {applyState.affiliateLink}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(applyState.affiliateLink)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (applyState.onboardingUrl) {
                          window.open(
                            applyState.onboardingUrl,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      disabled={!applyState.onboardingUrl}
                      className="w-full rounded-xl bg-black/30 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Finish Stripe Payout Setup
                    </button>
                    <p className="mt-2 text-xs text-white/60">
                      If the Stripe onboarding button is disabled, it means the server
                      didn’t return an onboarding URL yet (usually missing Stripe Connect
                      config). Your referral link is still valid.
                    </p>
                  </div>
                </div>
              )}

              {/* Keep this so you KNOW if you’re on old build */}
              <div className="pt-2 text-[11px] text-white/35">
                affiliate-page-build: v2-members-copy
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
