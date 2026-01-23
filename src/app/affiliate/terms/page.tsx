// src/app/affiliate/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

type ApplyState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const TERMS_HREF = "/affiliate/terms";

export default function AffiliatePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<ApplyState>({ status: "idle" });

  const canSubmit = useMemo(() => {
    const nameOk = fullName.trim().length >= 2;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return nameOk && emailOk && agree && state.status !== "submitting";
  }, [fullName, email, agree, state.status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState({ status: "submitting" });

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

      const data = await res.json().catch(() => null);

      // ✅ IMPORTANT: use onboardingUrl and redirect
      if (!res.ok || !data?.onboardingUrl) {
        console.error("[affiliate] onboarding failed:", { status: res.status, data });
        setState({
          status: "error",
          message:
            data?.error ||
            "Unable to start affiliate onboarding. Please try again in a minute.",
        });
        return;
      }

      setState({
        status: "success",
        message: "Redirecting you to Stripe onboarding…",
      });

      // Hard redirect to Stripe Connect onboarding
      window.location.href = data.onboardingUrl as string;
    } catch (err) {
      console.error("[affiliate] unexpected error:", err);
      setState({
        status: "error",
        message: "Network error. Please refresh and try again.",
      });
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/20";
  const labelClass = "text-xs font-medium text-white/70";
  const cardClass =
    "rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)]";

  return (
    <main className="min-h-[calc(100vh-80px)] bg-black">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(255,200,0,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_85%_30%,rgba(0,160,255,0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_45%_90%,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
            YieldCraft Partner Program
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Affiliate <span className="text-yellow-300">Program</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/70">
            Earn <span className="font-semibold text-yellow-200">30% recurring</span> by
            referring traders to YieldCraft. We track attribution and handle payouts via
            Stripe Connect.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: perks + rules */}
          <div className="space-y-6">
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white">What you get</h2>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
                  Tracked attribution (affiliate code → subscription)
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
                  Stripe Connect payouts (we review, then pay)
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
                  Promo assets + tracking links
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-yellow-300" />
                  Partner updates (email)
                </li>
              </ul>

              <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                <span className="font-semibold">Pro tip:</span> “Audience / channel” helps us approve
                faster and send you the right assets.
              </div>
            </div>

            <div className={cardClass}>
              <h3 className="text-lg font-semibold text-white">
                Strict rules (keeps you + YieldCraft protected)
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>• No spam / unsolicited messaging.</li>
                <li>• No misleading claims (especially performance).</li>
                <li>• No paid ads bidding on YieldCraft brand terms.</li>
                <li>• No “guarantees,” impersonation, or fake testimonials.</li>
              </ul>

              <div className="mt-4 text-sm text-white/70">
                Full terms:{" "}
                <Link href={TERMS_HREF} className="underline decoration-yellow-400/50 hover:text-white">
                  Affiliate Terms &amp; Compliance
                </Link>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className={cardClass}>
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@domain.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className={labelClass}>Audience / channel (optional)</label>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className={inputClass}
                  placeholder='Examples: "YouTube 12k", "X 8k", "Newsletter 2k", "Discord", "Client list"'
                />
              </div>

              <div>
                <label className={labelClass}>Website (optional)</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                  autoComplete="url"
                />
              </div>

              <div>
                <label className={labelClass}>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} min-h-[110px] resize-none`}
                  placeholder="Anything we should know?"
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-yellow-300"
                />
                <span>
                  I agree to the{" "}
                  <Link href={TERMS_HREF} className="underline text-yellow-200 hover:text-white">
                    Affiliate Terms
                  </Link>{" "}
                  and understand I cannot make performance claims, spam, or run brand-bidding ads.
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-2xl bg-gradient-to-r from-yellow-300 to-amber-300 py-3.5 text-center text-sm font-bold text-black shadow-[0_10px_40px_rgba(255,200,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.status === "submitting" ? "Redirecting…" : "Apply"}
              </button>

              {state.status === "error" && (
                <p className="text-sm font-medium text-red-400">{state.message}</p>
              )}

              {state.status === "success" && (
                <p className="text-sm font-medium text-emerald-400">{state.message}</p>
              )}

              <p className="pt-2 text-xs text-white/50">
                Anti-abuse is enforced. If we detect spam or misleading claims, the application may be rejected.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
