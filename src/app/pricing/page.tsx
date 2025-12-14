// src/app/pricing/page.tsx
import Link from "next/link";

const STARTER_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_STARTER ?? "#";
const RECON_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_RECON ?? "#";
const PRO_URL = process.env.NEXT_PUBLIC_STRIPE_LINK_PRO ?? "#";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            Plans &amp; pricing
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-50">
            Start with Pulse, scale into the full YieldCraft engine.
          </h1>
          <p className="mt-4 text-slate-400 max-w-2xl">
            Pulse Starter gets you live with a single BTC bot. Pulse + Recon
            adds intelligence gating. Pro Suite unlocks the full BTC bot lineup,
            built for real traders, not tourists.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Pulse Starter */}
          <div className="group relative flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-amber-500/50 hover:shadow-[0_0_60px_rgba(251,191,36,0.18)]">
            <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-amber-400/0 blur-2xl transition group-hover:bg-amber-400/10" />

            <h2 className="relative text-lg font-semibold text-slate-50">
              Pulse Starter
            </h2>
            <p className="relative mt-1 text-sm text-slate-400">
              Single Pulse BTC bot. Perfect for tiny accounts and first-time
              automation.
            </p>
            <p className="relative mt-6 text-3xl font-bold text-slate-50">
              $4.99
            </p>
            <p className="relative text-xs text-slate-500">per month</p>
            <ul className="relative mt-4 space-y-2 text-sm text-slate-300">
              <li>• Pulse BTC bot (maker-first execution)</li>
              <li>• Simple small-account sizing</li>
              <li>• Core risk guardrails baked in</li>
              <li>• Email-only support</li>
            </ul>
            <a
              href={STARTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pulse Starter
            </a>
          </div>

          {/* Pulse + Recon (Normalized — no permanent highlight) */}
          <div className="group relative flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-amber-500/50 hover:shadow-[0_0_60px_rgba(251,191,36,0.18)]">
            <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-amber-400/0 blur-2xl transition group-hover:bg-amber-400/10" />

            <h2 className="relative text-lg font-semibold text-slate-50">
              Pulse + Recon
            </h2>
            <p className="relative mt-1 text-sm text-slate-400">
              Pulse execution plus Recon&apos;s regime and confidence gating on
              the BTC engine.
            </p>
            <p className="relative mt-6 text-3xl font-bold text-slate-50">$9</p>
            <p className="relative text-xs text-slate-500">per month</p>
            <ul className="relative mt-4 space-y-2 text-sm text-slate-300">
              <li>• Everything in Pulse Starter</li>
              <li>• Recon trend / regime detection</li>
              <li>• Confidence gating on entries / exits</li>
              <li>• More robust risk behavior across cycles</li>
            </ul>
            <a
              href={RECON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pulse + Recon
            </a>
          </div>

          {/* Pro Suite (All Bots) */}
          <div className="group relative flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-amber-500/50 hover:shadow-[0_0_60px_rgba(251,191,36,0.18)]">
            <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-amber-400/0 blur-2xl transition group-hover:bg-amber-400/10" />

            <h2 className="relative text-lg font-semibold text-slate-50">
              Pro Suite (All Bots)
            </h2>
            <p className="relative mt-1 text-sm text-slate-400">
              Full BTC bot suite plus future bots as they come online.
            </p>
            <p className="relative mt-6 text-3xl font-bold text-slate-50">
              $39
            </p>
            <p className="relative text-xs text-slate-500">per month</p>
            <ul className="relative mt-4 space-y-2 text-sm text-slate-300">
              <li>• Pulse + Recon included</li>
              <li>• Horizon, Ignition, Edge, Hybrid as launched</li>
              <li>• Future BTC bots added to the suite</li>
              <li>• Priority feature updates</li>
            </ul>
            <a
              href={PRO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pro Suite
            </a>
          </div>
        </div>

        {/* Atlas (Core Allocator) — Long-Term Engine */}
        <div className="group relative mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-amber-500/50 hover:shadow-[0_0_70px_rgba(251,191,36,0.16)]">
          <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-amber-400/0 blur-2xl transition group-hover:bg-amber-400/10" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                New · Long-Term Engine
              </p>

              <h2 className="text-xl md:text-2xl font-semibold text-slate-50">
                YieldCraft Atlas
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                A buy-only, weekly capital allocator designed to help clients
                build long-term positions through disciplined accumulation into
                large-cap, highly liquid digital assets.
              </p>

              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li>• Buy-only weekly execution (no automated selling)</li>
                <li>• You control when to take profit — exits are always your choice</li>
                <li>• Liquidity-first universe so you can exit efficiently when you decide</li>
                <li>• Separate exchange account/portfolio required (no risk bleed)</li>
              </ul>

              <p className="mt-4 text-xs text-slate-500">
                Atlas does not attempt to predict short-term price movement. It
                maintains target ranges over time by adjusting future buys, not
                by selling existing holdings.
              </p>
            </div>

            <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
              <div>
                <p className="text-3xl font-bold text-slate-50">$9</p>
                <p className="text-xs text-slate-500">per month</p>
              </div>

              <Link
                href="/atlas"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
              >
                Learn about Atlas
              </Link>

              <p className="text-xs text-slate-500">
                Bundle-ready · Works from $100/month
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to homepage
          </Link>
          <Link
            href="/quick-start"
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
          >
            View Quick Start guide
          </Link>
        </div>
      </div>
    </main>
  );
}
