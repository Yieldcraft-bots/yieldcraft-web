// src/app/pricing/page.tsx
import Link from "next/link";

const STARTER_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_STARTER ?? "#";
const RECON_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_RECON ?? "#";
const PRO_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_PRO ?? "#";
const ATLAS_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_ATLAS ?? "#";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {/* HERO */}
        <div className="mb-14 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.3em] text-sky-400 uppercase">
            Pricing
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Real trading engines.
            <br />
            <span className="text-amber-400">
              Direct execution. Real guardrails.
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            YieldCraft is a direct-execution AI trading platform.
            <br />
            Start simple. Turn engines on as you grow.
          </p>

          <p className="mt-3 text-sm text-slate-400">
            No signal chasing. No black boxes. Your capital stays on your exchange —
            YieldCraft only executes.
          </p>
        </div>

        {/* ACTIVE TRADING ENGINES */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Pulse Starter */}
          <PlanCard
            title="Pulse Starter"
            description="A single BTC execution engine with strict risk controls."
            price="$4.99"
            bullets={[
              "Pulse BTC bot (maker-first execution)",
              "Designed for small accounts",
              "Daily loss caps & cooldowns",
              "Email-only support",
            ]}
            cta="Subscribe to Pulse Starter"
            href={STARTER_URL}
          />

          {/* Pulse + Recon */}
          <PlanCard
            title="Pulse + Recon"
            highlight
            description="Execution plus market-regime intelligence."
            price="$9"
            bullets={[
              "Everything in Pulse Starter",
              "Recon regime & confidence detection",
              "Smarter entries & exits",
              "More stable behavior across cycles",
            ]}
            cta="Subscribe to Pulse + Recon"
            href={RECON_URL}
          />

          {/* Pro Suite */}
          <PlanCard
            title="Pro Suite (All Bots)"
            description="Full active-trading stack for serious operators."
            price="$39"
            bullets={[
              "Pulse + Recon included",
              "Horizon, Ignition, Edge, Hybrid (as released)",
              "Future BTC bots automatically added",
              "Priority feature access",
            ]}
            cta="Subscribe to Pro Suite"
            href={PRO_URL}
          />
        </div>

        {/* ATLAS */}
        <div className="relative mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="max-w-3xl">
            <p className="mb-2 inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
              Long-Term Engine
            </p>

            <h2 className="text-2xl md:text-3xl font-bold">
              YieldCraft Atlas
            </h2>

            <p className="mt-4 text-slate-300">
              A buy-only, weekly capital allocator designed for disciplined
              long-term accumulation — without timing or predictions.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li>• Buy-only weekly execution</li>
              <li>• Client-controlled exits (you decide when to sell)</li>
              <li>• Liquidity-first universe</li>
              <li>• Runs in a separate portfolio (no risk bleed)</li>
            </ul>

            <p className="mt-4 text-xs text-slate-500">
              Atlas adjusts future buys over time — it never auto-sells existing holdings.
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
              href={ATLAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              Subscribe to Atlas
            </a>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
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
      className={`relative flex h-full flex-col rounded-3xl border p-6 transition ${
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
        className="mt-auto inline-flex justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
      >
        {cta}
      </a>
    </div>
  );
}
