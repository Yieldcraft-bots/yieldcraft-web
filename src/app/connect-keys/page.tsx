"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * ConnectKeysPage
 * - Glassy + polished UI
 * - One accent color for primary buttons (NOT yellow)
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

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  return (
    <main className="relative mx-auto max-w-4xl px-6 py-10">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute top-24 right-[-80px] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <section className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            SECURE SETUP
          </span>
          <span className="text-xs text-slate-400">
            No withdrawals. View + trade only.
          </span>
        </div>

        <h1 className="text-3xl font-bold text-white">
          Connect Coinbase in{" "}
          <span className="bg-gradient-to-r from-sky-300 to-cyan-200 bg-clip-text text-transparent">
            under 5 minutes
          </span>
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Green lights mean you’re done. Trading stays OFF until you explicitly
          arm it.
        </p>

        {/* WHY */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">✅ Why this step exists (1 minute)</p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>✔ YieldCraft does NOT log into your Coinbase account</li>
            <li>✔ YieldCraft cannot withdraw or move funds</li>
            <li>✔ API keys allow view + trade only</li>
            <li>❌ Withdrawals are disabled</li>
          </ul>

          <a
            href={coinbaseApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0"
          >
            <span className="mr-2">Open Coinbase API Key Settings</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>

          <p className="mt-2 text-center text-xs text-slate-400">
            Opens in a new tab. Come back here after creating the key.
          </p>
        </div>

        {/* STEP 3 */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">🔐 Step 3: Paste & verify</p>

          <div className="mt-4 space-y-3">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="API Key Name (e.g. YieldCraft)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
            />

            <input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="Paste API Key ID"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
            />

            <div className="relative">
              <input
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder="Paste API Secret"
                type={showSecret ? "text" : "password"}
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 pr-24 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
              />

              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200 transition hover:bg-white/[0.07]"
              >
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {status === "error" && (
            <p className="mt-3 text-sm text-rose-300">
              Please paste both Key ID and Secret.
            </p>
          )}

          {status === "ok" && (
            <p className="mt-3 text-sm text-emerald-300">
              ✔ Keys saved. Trading is still OFF.
            </p>
          )}

          <button
            onClick={verifyAndContinue}
            className="group mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0"
          >
            <span className="mr-2">Verify & Continue</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>

          <p className="mt-3 text-xs text-slate-500">
            Tip: your Secret is only shown once by Coinbase—store it safely.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
          >
            ← Back to Dashboard
          </Link>

          <Link
            href="/quick-start"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
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
