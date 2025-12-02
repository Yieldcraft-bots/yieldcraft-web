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
            adds intelligence gating. Pro Suite unlocks the full BTC bot
            lineup, built for real traders, not tourists.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Pulse Starter */}
          <div className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-slate-50">
              Pulse Starter
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Single Pulse BTC bot. Perfect for tiny accounts and first-time
              automation.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$4.99</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Pulse BTC bot (maker-first execution)</li>
              <li>• Simple small-account sizing</li>
              <li>• Core risk guardrails baked in</li>
              <li>• Email-only support</li>
            </ul>
            <a
              href={STARTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pulse Starter
            </a>
          </div>

          {/* Pulse + Recon */}
          <div className="flex h-full flex-col rounded-3xl border border-amber-500/70 bg-slate-900 p-6 shadow-lg shadow-amber-500/20">
            <p className="mb-2 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              Best value
            </p>
            <h2 className="text-lg font-semibold text-slate-50">
              Pulse + Recon
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Pulse execution plus Recon&apos;s regime and confidence gating on
              the BTC engine.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$9</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Everything in Pulse Starter</li>
              <li>• Recon trend / regime detection</li>
              <li>• Confidence gating on entries / exits</li>
              <li>• More robust risk behavior across cycles</li>
            </ul>
            <a
              href={RECON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pulse + Recon
            </a>
          </div>

          {/* Pro Suite (All Bots) */}
          <div className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-slate-50">
              Pro Suite (All Bots)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Full BTC bot suite plus future bots as they come online.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$39</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Pulse + Recon included</li>
              <li>• Horizon, Ignition, Edge, Hybrid as launched</li>
              <li>• Future BTC bots added to the suite</li>
              <li>• Priority feature updates</li>
            </ul>
            <a
              href={PRO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Subscribe to Pro Suite
            </a>
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
