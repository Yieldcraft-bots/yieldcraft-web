"use client";

import { useMemo, useState, type FormEvent } from "react";

type ApplyState =
  | { status: "idle" }
  | { status: "submitting" }
  | {
      status: "success";
      message: string;
      affiliateLink?: string;
      affiliateCode?: string;
      onboardingUrl?: string;
    }
  | { status: "error"; message: string };

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
      agree &&
      fullName.trim().length >= 2 &&
      email.trim().includes("@") &&
      applyState.status !== "submitting"
    );
  }, [agree, fullName, email, applyState.status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setApplyState({ status: "submitting" });

    try {
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          audience: audience.trim(),
          website: website.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const msg =
          data?.error ||
          data?.detail ||
          "Unable to start affiliate onboarding.";
        setApplyState({ status: "error", message: msg });
        return;
      }

      const affiliateLink: string | undefined = data?.affiliateLink;
      const affiliateCode: string | undefined = data?.affiliateCode;
      const onboardingUrl: string | undefined = data?.onboardingUrl;

      setApplyState({
        status: "success",
        message:
          "Application received. Your referral link is ready. Complete Stripe onboarding to get paid.",
        affiliateLink,
        affiliateCode,
        onboardingUrl,
      });

      // Attempt to open Stripe Connect onboarding in a new tab (works unless popup blocked)
      if (onboardingUrl) {
        window.open(onboardingUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setApplyState({
        status: "error",
        message: err?.message || "Unable to start affiliate onboarding.",
      });
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* LEFT */}
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">
              Affiliate <span className="text-[#f5c400]">Program</span>
            </h1>

            <p className="mt-4 text-lg text-white/80">
              Earn <span className="text-[#f5c400] font-bold">30% recurring</span>{" "}
              when you refer new members to YieldCraft.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold text-[#4fe3ff]">
                What you get
              </h3>
              <ul className="mt-4 space-y-2 text-white/80">
                <li>• Tracked attribution</li>
                <li>• Automated Stripe payouts (after onboarding)</li>
                <li>• Promo assets + tracking links</li>
                <li>• Partner updates (email)</li>
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-[#f5c400]/20 bg-[#f5c400]/10 p-5 text-[#f5c400]">
              Pro tip: “Audience / channel” helps us approve faster and send you
              the right assets.
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold">Strict rules (protects you + YieldCraft)</h3>
              <ul className="mt-3 space-y-2 text-white/80">
                <li>• No spam / unsolicited messaging</li>
                <li>• No misleading claims (especially performance)</li>
                <li>• No paid ads bidding on YieldCraft brand terms</li>
                <li>• No “guarantees,” no impersonation, no fake testimonials</li>
              </ul>

              <div className="mt-4 text-white/70">
                Full terms:{" "}
                <a
                  href="/affiliate/terms"
                  className="text-[#4fe3ff] hover:underline"
                >
                  Affiliate Terms & Compliance
                </a>
                .
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <form
              onSubmit={onSubmit}
              className="rounded-2xl border border-white/10 bg-white/5 p-8"
            >
              <div className="space-y-4">
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#4fe3ff]/60"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#4fe3ff]/60"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/90 outline-none focus:border-[#4fe3ff]/60"
                  placeholder="Audience / channel (optional)"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />

                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/90 outline-none focus:border-[#4fe3ff]/60"
                  placeholder="Website (optional)"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />

                <textarea
                  className="min-h-[140px] w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/90 outline-none focus:border-[#4fe3ff]/60"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <label className="mt-4 flex items-center gap-3 text-white/80">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="h-4 w-4 accent-[#f5c400]"
                />
                <span>
                  I agree to the{" "}
                  <a
                    href="/affiliate/terms"
                    className="text-[#4fe3ff] hover:underline"
                  >
                    Affiliate Terms
                  </a>
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-6 w-full rounded-xl bg-[#f5c400] px-6 py-4 text-lg font-bold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {applyState.status === "submitting" ? "Submitting..." : "Apply"}
              </button>

              {/* Status */}
              <div className="mt-4">
                {applyState.status === "error" ? (
                  <p className="text-sm text-red-400">{applyState.message}</p>
                ) : null}

                {applyState.status === "success" ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm text-emerald-300">
                      {applyState.message}
                    </p>

                    {applyState.affiliateLink ? (
                      <div className="mt-3">
                        <div className="text-xs text-white/60">Your referral link</div>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            readOnly
                            value={applyState.affiliateLink}
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
                          />
                          <button
                            type="button"
                            onClick={() => copy(applyState.affiliateLink!)}
                            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                          >
                            Copy
                          </button>
                        </div>
                        {applyState.affiliateCode ? (
                          <div className="mt-2 text-xs text-white/60">
                            Code: <span className="text-white/90">{applyState.affiliateCode}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {applyState.onboardingUrl ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              applyState.onboardingUrl!,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="w-full rounded-lg bg-[#4fe3ff] px-4 py-3 text-sm font-bold text-black hover:brightness-95"
                        >
                          Finish Stripe Payout Setup
                        </button>
                        <p className="mt-2 text-xs text-white/60">
                          If the onboarding tab didn’t open, click the button above.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
