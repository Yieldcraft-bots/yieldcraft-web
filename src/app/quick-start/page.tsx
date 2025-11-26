// src/app/quick-start/page.tsx
import Link from "next/link";

export default function QuickStartPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
          Quick start guide
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-50">
          Go from zero to live Pulse + Recon in a few steps.
        </h1>
        <p className="mt-4 text-slate-400 max-w-2xl">
          This is the high-level map. We&apos;ll keep refining it, but this is
          enough to go from &quot;curious&quot; to watching real trades execute
          through the engine.
        </p>

        <ol className="mt-8 space-y-6 text-sm text-slate-200">
          <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50">
              1. Create / connect your Coinbase Advanced Trade account
            </h2>
            <p className="mt-2 text-slate-400">
              Enable Advanced Trade, generate an API key with View + Trade
              permissions, and store it somewhere safe. YieldCraft never shares
              or sells keys.
            </p>
          </li>

          <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50">
              2. Subscribe to YieldCraft (Starter is enough)
            </h2>
            <p className="mt-2 text-slate-400">
              Starter unlocks the Pulse + Recon BTC engine for small accounts.
              Pro / Elite will bring in more bots and cross-asset logic over
              time.
            </p>
          </li>

          <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50">
              3. Wire your keys into the engine
            </h2>
            <p className="mt-2 text-slate-400">
              Inside the secure onboarding flow, you&apos;ll paste your Coinbase
              key name and private key. The engine uses signed JWTs to talk to
              Coinbase directly — no third-party bridges.
            </p>
          </li>

          <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50">
              4. Start in small-account guardrail mode
            </h2>
            <p className="mt-2 text-slate-400">
              We start with tiny BTC position sizes and strict daily drawdown
              caps. The goal is clean execution and survival first, growth
              second.
            </p>
          </li>

          <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-50">
              5. Review live trades and logs
            </h2>
            <p className="mt-2 text-slate-400">
              You&apos;ll be able to see which bot fired, what Recon saw
              (regime + confidence), and exactly how each order hit Coinbase
              (maker or fallback).
            </p>
          </li>
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
          >
            View pricing
          </Link>
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
