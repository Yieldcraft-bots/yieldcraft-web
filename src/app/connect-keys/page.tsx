// src/app/connect-keys/page.tsx
import Link from "next/link";

const COINBASE_REF_PATH = "/go/coinbase"; // server-side redirect you already created

export default function ConnectKeysPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-20">
        {/* HEADER */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Secure Onboarding
          </p>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight">
            Connect your <span className="text-amber-400">Coinbase API keys</span>
          </h1>

          <p className="mt-4 text-lg text-slate-300">
            YieldCraft connects directly to Coinbase using signed requests.
            <br />
            We never withdraw. Funds stay on Coinbase.
          </p>
        </div>

        {/* STEP 0 (Affiliate / attribution helper) */}
        <div className="mb-6 rounded-3xl border border-emerald-900/40 bg-emerald-950/25 p-6">
          <h3 className="text-lg font-semibold mb-2">
            0. New to Coinbase? Start here first (one time)
          </h3>

          <p className="text-sm text-slate-300 mb-4">
            If you don’t have a Coinbase account yet, click this first so Coinbase can attribute
            your signup to YieldCraft.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={COINBASE_REF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Create Coinbase account →
            </a>

            <p className="text-xs text-slate-500 self-center">
              Attribution is handled by Coinbase; this step helps ensure the referral click happens first.
            </p>
          </div>
        </div>

        {/* STEP 1 */}
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold mb-2">1. Create a Coinbase API key</h3>

          <p className="text-sm text-slate-400 mb-4">
            Open Coinbase API settings and create a key with:
          </p>

          <ul className="mb-4 list-disc pl-5 text-sm text-slate-300 space-y-1">
            <li>
              <strong>Permissions:</strong> View + Trade
            </li>
            <li>
              <strong>Trading:</strong> Enabled
            </li>
            <li>
              <strong>Withdrawals:</strong> ❌ Disabled
            </li>
          </ul>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.coinbase.com/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
            >
              Open Coinbase API Settings →
            </a>

            <a
              href={COINBASE_REF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              New to Coinbase? Start here →
            </a>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Tip: If you’re brand new, click “Start here” first, then come back and create the API key.
          </p>
        </div>

        {/* STEP 2 */}
        <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold mb-2">2. Paste your keys into YieldCraft</h3>

          <p className="text-sm text-slate-400">You’ll paste:</p>

          <ul className="mt-2 list-disc pl-5 text-sm text-slate-300 space-y-1">
            <li>API Key Name</li>
            <li>Private Key (secure input)</li>
          </ul>

          <p className="mt-3 text-xs text-slate-500">
            Keys are used only to sign requests. Funds stay on Coinbase.
          </p>
        </div>

        {/* STEP 3 */}
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold mb-2">3. Confirm green lights</h3>

          <p className="text-sm text-slate-400">
            Once connected, your dashboard will show:
          </p>

          <ul className="mt-2 list-disc pl-5 text-sm text-slate-300 space-y-1">
            <li>Connected</li>
            <li>Engine Armed</li>
            <li>Waiting for Signal (normal)</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/quick-start"
            className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold hover:border-slate-500"
          >
            Back to Quick Start
          </Link>
        </div>

        <p className="mt-10 text-xs text-slate-500">
          Note: Coinbase referral eligibility and commissions are determined by Coinbase’s program terms and the user’s region.
        </p>
      </div>
    </main>
  );
}
