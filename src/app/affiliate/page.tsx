"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

type ApplyState =
  | { status: "idle" }
  | { status: "submitting" }
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

      const json = await res.json();

      if (!res.ok || !json?.onboardingUrl) {
        throw new Error(json?.error || "Unable to start affiliate onboarding.");
      }

      // 🔥 THIS WAS MISSING — REDIRECT TO STRIPE
      window.location.href = json.onboardingUrl;
    } catch (err: any) {
      setState({
        status: "error",
        message: err?.message || "Unable to start affiliate onboarding.",
      });
    }
  }

  return (
    <main className="relative min-h-screen bg-[#050b1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-5xl font-semibold mb-6">
          Affiliate{" "}
          <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
            Program
          </span>
        </h1>

        <p className="text-lg text-white/70 mb-10">
          Earn <span className="text-yellow-300 font-semibold">{COMMISSION_HIGHLIGHT}</span>{" "}
          referring traders to YieldCraft.
        </p>

        <form onSubmit={onSubmit} className="max-w-xl space-y-4">
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />

          <input
            placeholder="Audience / channel (optional)"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={inputClass}
          />

          <input
            placeholder="Website (optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className={inputClass}
          />

          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} min-h-[120px]`}
          />

          <label className="flex gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            I agree to the{" "}
            <Link href={TERMS_HREF} className="underline text-yellow-300">
              Affiliate Terms
            </Link>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl py-3 font-semibold text-black bg-gradient-to-r from-yellow-400 to-amber-400 disabled:opacity-50"
          >
            {state.status === "submitting" ? "Redirecting…" : "Apply"}
          </button>

          {state.status === "error" && (
            <p className="text-red-400 text-sm">{state.message}</p>
          )}
        </form>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white";
