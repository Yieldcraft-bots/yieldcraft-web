// src/app/affiliate/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

type ApplyState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const COMMISSION_HIGHLIGHT = "30% recurring";
const TERMS_HREF = "/affiliate/terms";

export default function AffiliatePage() {
  const [state, setState] = useState<ApplyState>({ status: "idle" });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const canSubmit = useMemo(() => {
    return fullName.trim().length >= 2 && email.includes("@") && acceptedTerms;
  }, [fullName, email, acceptedTerms]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || state.status === "submitting") return;

    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          audience,
          website,
          notes,
          acceptedTerms: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Submission failed");

      setState({
        status: "success",
        message: "Application received. Check your email for next steps.",
      });

      // optional: clear fields on success
      // setFullName(""); setEmail(""); setAudience(""); setWebsite(""); setNotes(""); setAcceptedTerms(false);
    } catch (err: any) {
      setState({
        status: "error",
        message: err?.message || "Something went wrong",
      });
    }
  }

  return (
    <main className="relative min-h-screen bg-[#050b1a] text-white overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-[-200px] h-[500px] w-[500px] rounded-full bg-yellow-400/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20">
        {/* HERO */}
        <div className="mb-14 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-xs text-yellow-300">
            DIRECT EXECUTION · PARTNER PROGRAM
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold leading-tight">
            Affiliate{" "}
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Program
            </span>
          </h1>

          <p className="mt-6 text-lg text-white/70">
            Earn{" "}
            <span className="text-yellow-200 font-semibold">
              {COMMISSION_HIGHLIGHT}
            </span>{" "}
            by referring serious traders to YieldCraft.
          </p>

          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm text-yellow-100/90">
            <p className="font-semibold text-yellow-200">
              Simple, automated, and paid through Stripe.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-yellow-100/80">
              <li>
                Commissions are tied to the customer subscription and paid
                automatically via Stripe payouts (not “manually from Donnie”).
              </li>
              <li>
                No performance claims. No spam. No brand bidding. Strict
                compliance keeps this program safe.
              </li>
            </ul>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-2">
          {/* LEFT */}
          <div className="space-y-8">
            <GlassCard title="How it works" accent="yellow">
              <ol className="list-decimal pl-5 space-y-3 text-white/80">
                <li>Apply (takes ~30 seconds)</li>
                <li>Get your referral link</li>
                <li>Earn recurring payouts while they stay subscribed</li>
              </ol>
            </GlassCard>

            <GlassCard title="What you get" accent="cyan">
              <ul className="list-disc pl-5 space-y-3 text-white/80">
                <li>Tracked attribution</li>
                <li>Automated Stripe payouts</li>
                <li>Promo assets + tracking links</li>
                <li>Partner updates (email)</li>
              </ul>
            </GlassCard>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm text-yellow-200">
              <strong>Pro tip:</strong> “Audience / channel” helps us approve
              faster and send you the right assets.
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs text-white/60">
              <p className="font-semibold text-white/70">
                Strict rules (keeps you + YieldCraft protected):
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>No spam / unsolicited messaging.</li>
                <li>No misleading claims (especially performance).</li>
                <li>No paid ads bidding on YieldCraft brand terms.</li>
                <li>
                  No “guarantees,” no impersonation, no fake testimonials.
                </li>
              </ul>
              <p className="mt-3">
                Full terms:{" "}
                <Link
                  href={TERMS_HREF}
                  className="text-yellow-200 hover:text-yellow-100 underline"
                >
                  Affiliate Terms & Compliance
                </Link>
                .
              </p>
            </div>
          </div>

          {/* FORM */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Apply now</h2>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                Fast approval
              </span>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <Field label="Full name *">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  autoComplete="name"
                />
              </Field>

              <Field label="Email *">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </Field>

              <Field
                label="Audience / channel (optional)"
                hint='Examples: “YouTube 12k subs”, “X (Twitter) 8k”, “Newsletter 2k”, “Discord group”, “Client list”'
              >
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className={inputClass}
                  placeholder="Where do you refer people from?"
                />
              </Field>

              <Field label="Website (optional)">
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={inputClass}
                  placeholder="https://"
                />
              </Field>

              <Field label="Notes (optional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} min-h-[120px]`}
                  placeholder="Anything we should know?"
                />
              </Field>

              {/* Terms checkbox (required) */}
              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40"
                />
                <span className="text-xs text-white/70">
                  I agree to the{" "}
                  <a
                    href={TERMS_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-200 hover:text-yellow-100 underline"
                  >
                    Affiliate Terms &amp; Conditions
                  </a>{" "}
                  and understand I cannot make performance claims, spam, or run
                  brand-bidding ads.
                </span>
              </label>

              {/* APPLY BUTTON — ALWAYS YELLOW */}
              <button
                type="submit"
                className={`w-full rounded-xl py-3 font-semibold text-black transition
                  ${
                    canSubmit
                      ? "bg-gradient-to-r from-yellow-400 to-amber-400 hover:brightness-110"
                      : "bg-yellow-400 opacity-50 cursor-not-allowed"
                  }`}
              >
                {state.status === "submitting" ? "Submitting…" : "Apply"}
              </button>

              {state.status === "success" && (
                <div className="text-sm text-green-300">{state.message}</div>
              )}
              {state.status === "error" && (
                <div className="text-sm text-red-300">{state.message}</div>
              )}

              <p className="pt-2 text-xs text-white/50">
                Anti-abuse is enforced. If we detect spam or misleading claims,
                the application is rejected automatically.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function GlassCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "yellow" | "cyan";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <h3
        className={`mb-4 text-lg font-semibold ${
          accent === "yellow" ? "text-yellow-300" : "text-cyan-300"
        }`}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-4">
        <div className="mb-2 text-xs text-white/70">{label}</div>
        {hint ? (
          <div className="mb-2 hidden md:block text-[11px] text-white/35">
            {hint}
          </div>
        ) : null}
      </div>
      {children}
      {hint ? (
        <div className="mt-2 md:hidden text-[11px] text-white/35">
          {hint}
        </div>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-yellow-400/50";
