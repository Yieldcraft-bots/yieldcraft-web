"use client";

// src/app/pricing/page.tsx
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STARTER_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_STARTER ?? "#";
const RECON_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_RECON ?? "#";
const PRO_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_PRO ?? "#";
const ATLAS_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_ATLAS ?? "#";

const REF_STORAGE_KEY = "yc_ref";

function normalizeRef(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

function buildCheckoutUrl(baseUrl: string, refCode: string) {
  if (!baseUrl || baseUrl === "#") return "#";

  try {
    const url = new URL(baseUrl);
    if (refCode) {
      url.searchParams.set("client_reference_id", `aff_${refCode}`);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export default function PricingPage() {
  const [refCode, setRefCode] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = normalizeRef(params.get("ref"));

      if (fromUrl) {
        localStorage.setItem(REF_STORAGE_KEY, fromUrl);
        setRefCode(fromUrl);
        return;
      }

      const saved = normalizeRef(localStorage.getItem(REF_STORAGE_KEY));
      if (saved) setRefCode(saved);
    } catch {
      // no-op
    }
  }, []);

  const starterHref = useMemo(
    () => buildCheckoutUrl(STARTER_URL, refCode),
    [refCode]
  );
  const growthHref = useMemo(
    () => buildCheckoutUrl(RECON_URL, refCode),
    [refCode]
  );
  const proHref = useMemo(() => buildCheckoutUrl(PRO_URL, refCode), [refCode]);
  const atlasHref = useMemo(
    () => buildCheckoutUrl(ATLAS_URL, refCode),
    [refCode]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-14 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
            Pricing
          </p>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
            Direct execution memberships.
            <br />
            <span className="text-amber-400">
              Real guardrails. Real account control.
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            YieldCraft is a direct-execution system built for disciplined
            operators.
            <br />
            Start lean. Upgrade as your account and needs grow.
          </p>

          <p className="mt-3 text-sm text-slate-400">
            No signal chasing. No black boxes. Your capital stays on your
            exchange — YieldCraft only operates the systems you enable.
          </p>

          {refCode ? (
            <div className="mt-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200">
              Referral applied
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <PlanCard
            title="Starter"
            description="Entry-level direct execution for smaller accounts and disciplined first-time users."
            price="$4.99"
            bullets={[
              "BTC execution engine",
              "Risk caps, cooldowns, and hard stops",
              "Built for smaller starting balances",
              "Email support",
            ]}
            cta="Start Starter"
            href={starterHref}
          />

          <PlanCard
            title="Growth"
            highlight
            description="Execution plus market-awareness for users who want a smarter and more stable operating layer."
            price="$9"
            bullets={[
              "Everything in Starter",
              "Regime and confidence intelligence",
              "Smarter entry filtering",
              "Better cycle-to-cycle stability",
            ]}
            cta="Start Growth"
            href={growthHref}
          />

          <PlanCard
            title="Pro"
            description="Full membership tier for serious operators who want the complete YieldCraft stack."
            price="$39"
            bullets={[
              "Everything in Growth",
              "Access to the full active stack",
              "New released systems included",
              "Priority feature access",
            ]}
            cta="Start Pro"
            href={proHref}
          />
        </div>

        <div className="relative mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="max-w-3xl">
            <p className="mb-2 inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              Long-Term Engine
            </p>

            <h2 className="text-2xl font-bold md:text-3xl">
              Atlas Membership
            </h2>

            <p className="mt-4 text-slate-300">
              A disciplined accumulation system designed to build long-term
              positions automatically — without requiring constant attention,
              prediction, or emotional decision-making.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li>• Buy-only accumulation</li>
              <li>• Continuous monitoring</li>
              <li>• Liquidity-first asset universe</li>
              <li>• Client-controlled exits</li>
              <li>
                • Requires a separate Coinbase account or portfolio (critical
                for risk separation)
              </li>
            </ul>

            <p className="mt-4 text-xs text-slate-500">
              Atlas adjusts future buys over time — it never auto-sells
              existing holdings.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Use a dedicated Coinbase account or portfolio for Atlas. Do not
              share it with Pulse or other active trading systems.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Atlas manages long-term accumulation. Active execution systems
              manage shorter-horizon opportunity. These systems must never share
              funds or API credentials.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Atlas runs on the same execution infrastructure powering
              YieldCraft systems.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-3xl font-bold">$9</p>
              <p className="text-xs text-slate-500">per month</p>
            </div>

            <Link
              href="/atlas"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500"
            >
              Learn about Atlas
            </Link>

            <a
              href={atlasHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              Start Atlas
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-4">
          <Link
            href="/quick-start"
            className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
          >
            Quick Start (5 minutes)
          </Link>

          <Link
            href="/"
            className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold hover:border-slate-500"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

function PlanCard({
  title,
  description,
  price,
  bullets,
  cta,
  href,
  highlight,
}: {
  title: string;
  description: string;
  price: string;
  bullets: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 hover:border-amber-400/40 hover:bg-slate-900/60 ${
        highlight
          ? "border-amber-500/50 bg-slate-900/60 shadow-[0_0_60px_rgba(251,191,36,0.25)]"
          : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>

      <div className="mt-6">
        <p className="text-3xl font-bold">{price}</p>
        <p className="text-xs text-slate-500">per month</p>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-slate-300">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        {cta}
      </a>
    </div>
  );
}