// src/app/pricing/page.tsx
import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            Plans & pricing
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-50">
            Start with Pulse, scale into the full YieldCraft engine.
          </h1>
          <p className="mt-4 text-slate-400 max-w-2xl">
            Pulse + Recon runs the BTC engine. Ascend, Horizon, Ignition and
            the rest of the fleet come online as we move into Pro and Elite
            tiers. All plans are designed for real traders, not tourists.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Starter */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-slate-50">Starter</h2>
            <p className="mt-1 text-sm text-slate-400">
              Pulse + Recon BTC engine. Best for small accounts and first-time
              automation.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$9</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Pulse BTC bot (maker-first execution)</li>
              <li>• Recon regime & confidence gating</li>
              <li>• Small-account risk guardrails</li>
              <li>• Email support</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-3xl border border-amber-500/70 bg-slate-900 p-6 shadow-lg shadow-amber-500/20">
            <p className="mb-2 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              Most popular
            </p>
            <h2 className="text-lg font-semibold text-slate-50">Pro</h2>
            <p className="mt-1 text-sm text-slate-400">
              Full BTC engine plus additional bots as they come online.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$39</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Everything in Starter</li>
              <li>• Horizon & Ignition access as launched</li>
              <li>• Priority updates on new strategies</li>
              <li>• Priority support</li>
            </ul>
          </div>

          {/* Elite */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-slate-50">Elite</h2>
            <p className="mt-1 text-sm text-slate-400">
              For larger accounts, multi-bot fleets, and Core Fund alignment.
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-50">$79+</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Everything in Pro</li>
              <li>• Early access to Ascend / Forge logic</li>
              <li>• Priority roadmap input</li>
              <li>• Direct support channel</li>
            </ul>
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
