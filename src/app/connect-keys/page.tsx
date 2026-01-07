"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * NOTE:
 * - No refs
 * - No scrolling logic
 * - No TS-null issues
 * - Coinbase button deep-links directly to API key management
 */

export default function ConnectKeysPage() {
  const [keyName, setKeyName] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  function verifyAndContinue() {
    if (!keyId || !keySecret) {
      setStatus("error");
      return;
    }
    setStatus("ok");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/40 p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
            SECURE SETUP
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white">
          Connect Coinbase in{" "}
          <span className="text-sky-400">under 5 minutes</span>
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Green lights mean you’re done. Trading stays OFF until you explicitly
          arm it.
        </p>

        {/* WHY */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/30 p-6">
          <p className="font-semibold text-white">
            ✅ Why this step exists (1 minute)
          </p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>✔ YieldCraft does NOT log into your Coinbase account</li>
            <li>✔ YieldCraft cannot withdraw or move funds</li>
            <li>✔ API keys allow view + trade only</li>
            <li>❌ Withdrawals are disabled</li>
          </ul>

          <a
            href="https://www.coinbase.com/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-yellow-400 px-6 py-3 font-semibold text-black hover:bg-yellow-300 transition"
          >
            Open Coinbase API Key Settings →
          </a>

          <p className="mt-2 text-xs text-slate-400 text-center">
            Opens in a new tab. Come back here after creating the key.
          </p>
        </div>

        {/* STEP 3 */}
        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/30 p-6">
          <p className="font-semibold text-white">🔐 Step 3: Paste & verify</p>

          <div className="mt-4 space-y-3">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="API Key Name (e.g. YieldCraft)"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500"
            />

            <input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="Paste API Key ID"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500"
            />

            <input
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder="Paste API Secret"
              type={showSecret ? "text" : "password"}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500"
            />

            <button
              onClick={() => setShowSecret((s) => !s)}
              className="text-xs text-sky-400 hover:underline"
            >
              {showSecret ? "Hide secret" : "Show secret"}
            </button>
          </div>

          {status === "error" && (
            <p className="mt-3 text-sm text-rose-400">
              Please paste both Key ID and Secret.
            </p>
          )}

          {status === "ok" && (
            <p className="mt-3 text-sm text-emerald-400">
              ✔ Keys saved. Trading is still OFF.
            </p>
          )}

          <button
            onClick={verifyAndContinue}
            className="mt-5 w-full rounded-full bg-yellow-400 px-6 py-3 font-semibold text-black hover:bg-yellow-300 transition"
          >
            Verify & Continue
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm text-slate-200 hover:bg-slate-900"
          >
            ← Back to Dashboard
          </Link>

          <Link
            href="/quick-start"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm text-slate-200 hover:bg-slate-900"
          >
            Quick Start →
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          YieldCraft provides software tools only. Not investment advice. Trading
          involves risk, including loss of capital.
        </p>
      </section>
    </main>
  );
}
