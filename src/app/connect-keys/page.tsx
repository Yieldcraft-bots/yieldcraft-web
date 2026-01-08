"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * ConnectKeysPage (Coinbase CDP)
 * - Glassy + polished UI
 * - Uses Coinbase CDP fields (API Key Name + Private Key PEM)
 * - Calls POST /api/connect-keys to verify + store encrypted per user
 *
 * IMPORTANT:
 * Coinbase CDP is NOT "API key + secret".
 * It is:
 *  - coinbase_api_key_name (organizations/.../apiKeys/...)
 *  - coinbase_private_key (-----BEGIN ... PRIVATE KEY----- ... )
 */

type Status = "idle" | "verifying" | "ok" | "error";

export default function ConnectKeysPage() {
  const [label, setLabel] = useState("Coinbase");
  const [apiKeyName, setApiKeyName] = useState(""); // organizations/.../apiKeys/...
  const [privateKeyPem, setPrivateKeyPem] = useState(""); // PEM block
  const [showPem, setShowPem] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [verifiedAt, setVerifiedAt] = useState<string>("");

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  async function verifyAndContinue() {
    setErrorMsg("");
    setVerifiedAt("");

    if (!apiKeyName.trim()) {
      setStatus("error");
      setErrorMsg(
        "Paste your Coinbase API Key Name (organizations/.../apiKeys/...)."
      );
      return;
    }

    if (!privateKeyPem.trim()) {
      setStatus("error");
      setErrorMsg("Paste your Coinbase Private Key (PEM).");
      return;
    }

    const pem = privateKeyPem.trim();

    // Coinbase may show EC PRIVATE KEY (SEC1) or PRIVATE KEY (PKCS8). Accept both.
    const looksLikePem =
      pem.includes("BEGIN") &&
      (pem.includes("PRIVATE KEY") || pem.includes("EC PRIVATE KEY")) &&
      pem.includes("END");

    if (!looksLikePem) {
      setStatus("error");
      setErrorMsg(
        "That doesn’t look like a Private Key PEM. It should include BEGIN/END lines (e.g. -----BEGIN EC PRIVATE KEY----- ...)."
      );
      return;
    }

    setStatus("verifying");

    try {
      const res = await fetch("/api/connect-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          label: (label || "Coinbase").trim(),
          coinbase_api_key_name: apiKeyName.trim(),
          coinbase_private_key: privateKeyPem, // preserve newlines as pasted
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus("error");
        setErrorMsg(
          data?.error ||
            `Verify failed (HTTP ${res.status}). Ensure permissions are View + Trade, Transfer is OFF, and you pasted CDP "API key name" + "Private key".`
        );
        return;
      }

      setStatus("ok");
      setVerifiedAt(data?.verified_at || new Date().toISOString());
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(String(e?.message || e || "Verify failed"));
    }
  }

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
          When this turns green, your Coinbase connection is verified. Trading
          stays OFF until you explicitly arm it.
        </p>

        {/* WHY */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">
            ✅ Why this step exists (1 minute)
          </p>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>✔ YieldCraft does NOT log into your Coinbase account</li>
            <li>✔ YieldCraft cannot withdraw or move funds</li>
            <li>✔ API keys allow view + trade only</li>
            <li>❌ Withdrawals/Transfer permission should stay OFF</li>
          </ul>

          <a
            href={coinbaseApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0"
          >
            <span className="mr-2">Open Coinbase API Key Settings</span>
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>

          <p className="mt-2 text-center text-xs text-slate-400">
            Opens in a new tab. Create a key, then come back here.
          </p>
        </div>

        {/* WHAT TO COPY (visual help) */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">🧩 What to copy from Coinbase</p>

          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-slate-100">1)</span> Click{" "}
              <span className="font-semibold text-slate-100">Create API key</span>
            </li>
            <li>
              <span className="font-semibold text-slate-100">2)</span> Select{" "}
              <span className="font-semibold text-slate-100">Portfolio: Primary</span>
            </li>
            <li>
              <span className="font-semibold text-slate-100">3)</span> Enable{" "}
              <span className="font-semibold text-slate-100">View</span> ✅ and{" "}
              <span className="font-semibold text-slate-100">Trade</span> ✅
              (leave <span className="font-semibold text-slate-100">Transfer</span> OFF)
            </li>
            <li>
              <span className="font-semibold text-slate-100">4)</span> Leave{" "}
              <span className="font-semibold text-slate-100">IP whitelist blank</span>
            </li>
            <li>
              <span className="font-semibold text-slate-100">5)</span> Click{" "}
              <span className="font-semibold text-slate-100">Create &amp; download</span>
            </li>
            <li>
              <span className="font-semibold text-slate-100">6)</span> Copy these two
              values into YieldCraft:
            </li>
          </ol>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">API Key Name</p>
              <p className="mt-1 text-xs text-slate-400">
                Looks like{" "}
                <span className="font-mono text-slate-200">organizations/…</span>
              </p>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-slate-200">
                organizations/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/apiKeys/xxxxxxxx-xxxx…
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">Private Key</p>
              <p className="mt-1 text-xs text-slate-400">
                A PEM block starting with{" "}
                <span className="font-mono text-slate-200">BEGIN</span>
              </p>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-slate-200">
                -----BEGIN EC PRIVATE KEY-----{"\n"}
                …your key…{"\n"}
                -----END EC PRIVATE KEY-----
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Your Private Key is shown once by Coinbase. Store it safely. YieldCraft cannot withdraw funds.
          </p>
        </div>

        {/* STEP: PASTE + VERIFY */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">🔐 Paste & verify</p>

          <div className="mt-4 space-y-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Coinbase)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
            />

            <input
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              placeholder="Coinbase API Key Name (organizations/.../apiKeys/...)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
            />

            <div className="relative">
              <textarea
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                placeholder="Coinbase Private Key (PEM) — starts with -----BEGIN ... PRIVATE KEY-----"
                rows={showPem ? 8 : 4}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 pr-24 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                style={{ WebkitTextSecurity: showPem ? "none" : "disc" } as any}
              />

              <button
                type="button"
                onClick={() => setShowPem((s) => !s)}
                className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200 transition hover:bg-white/[0.07]"
              >
                {showPem ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {status === "error" && (
            <p className="mt-3 text-sm text-rose-300">
              {errorMsg || "Verify failed."}
            </p>
          )}

          {status === "ok" && (
            <p className="mt-3 text-sm text-emerald-300">
              ✔ Verified. Coinbase is connected. Trading is still OFF.{" "}
              {verifiedAt ? (
                <span className="text-xs text-slate-400">
                  (Verified: {verifiedAt})
                </span>
              ) : null}
            </p>
          )}

          <button
            onClick={verifyAndContinue}
            disabled={status === "verifying"}
            className="group mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="mr-2">
              {status === "verifying" ? "Verifying..." : "Verify & Continue"}
            </span>
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>

          <p className="mt-3 text-xs text-slate-500">
            Your key is encrypted at rest. YieldCraft cannot withdraw funds. You can revoke the key anytime in Coinbase.
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
