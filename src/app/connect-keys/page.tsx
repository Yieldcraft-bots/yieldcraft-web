"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "idle" | "verifying" | "ok" | "error";

export default function ConnectKeysPage() {
  const [label, setLabel] = useState("Coinbase");
  const [apiKeyName, setApiKeyName] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [showPem, setShowPem] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  async function verifyAndContinue() {
    setErrorMsg("");

    if (!apiKeyName.trim()) {
      setStatus("error");
      setErrorMsg("Paste the API Key Name from Coinbase.");
      return;
    }

    if (!privateKeyPem.trim()) {
      setStatus("error");
      setErrorMsg("Paste the Private Key from Coinbase.");
      return;
    }

    setStatus("verifying");

    try {
      const res = await fetch("/api/connect-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          coinbase_api_key_name: apiKeyName.trim(),
          coinbase_private_key: privateKeyPem.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setStatus("error");
        setErrorMsg(
          data?.error ||
            "Verification failed. Make sure permissions are View + Trade."
        );
        return;
      }

      setStatus("ok");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-white">
          Connect Coinbase in under 5 minutes
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Trading stays OFF until you explicitly enable it.
        </p>

        {/* WHY */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">Why this is safe</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>✔ YieldCraft never logs into your Coinbase account</li>
            <li>✔ Withdrawals are disabled</li>
            <li>✔ Keys can be revoked anytime</li>
          </ul>
        </div>

        {/* STEP 1 */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">
            Step 1: Open Coinbase API settings
          </p>

          <a
            href={coinbaseApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950"
          >
            Open Coinbase API Settings →
          </a>
        </div>

        {/* STEP 2 – THIS IS THE IMPORTANT PART */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">
            Step 2: Copy from Coinbase (IMPORTANT)
          </p>

          <div className="mt-3 text-sm text-slate-300 space-y-2">
            <p>
              Coinbase will show each value with a small{" "}
              <span className="font-semibold text-white">
                copy icon ⧉
              </span>{" "}
              on the right.
            </p>

            <p className="font-semibold text-emerald-300">
              👉 CLICK THE COPY ICON.
            </p>

            <p className="text-rose-300">
              ❌ Do NOT highlight or drag-select the text.
            </p>

            <ul className="mt-3 list-disc pl-5">
              <li>
                Copy <b>API Key Name</b> (starts with{" "}
                <code className="text-sky-300">organizations/</code>)
              </li>
              <li>
                Copy <b>Private Key</b> (starts with{" "}
                <code className="text-sky-300">
                  -----BEGIN PRIVATE KEY-----
                </code>
                )
              </li>
            </ul>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">
            Step 3: Paste below and verify
          </p>

          <div className="mt-4 space-y-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl bg-slate-950/40 px-4 py-3 text-white"
              placeholder="Label (e.g. Coinbase)"
            />

            <input
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              className="w-full rounded-xl bg-slate-950/40 px-4 py-3 text-white"
              placeholder="Paste API Key Name here"
            />

            <textarea
              value={privateKeyPem}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              rows={showPem ? 6 : 4}
              className="w-full rounded-xl bg-slate-950/40 px-4 py-3 text-white"
              placeholder="Paste Private Key here"
              style={{ WebkitTextSecurity: showPem ? "none" : "disc" } as any}
            />

            <button
              onClick={() => setShowPem((s) => !s)}
              className="text-xs text-slate-300 underline"
            >
              {showPem ? "Hide key" : "Show key"}
            </button>
          </div>

          {status === "error" && (
            <p className="mt-3 text-sm text-rose-300">{errorMsg}</p>
          )}

          {status === "ok" && (
            <p className="mt-3 text-sm text-emerald-300">
              ✔ Coinbase connected. Trading is still OFF.
            </p>
          )}

          <button
            onClick={verifyAndContinue}
            disabled={status === "verifying"}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950"
          >
            {status === "verifying" ? "Verifying..." : "Verify & Continue →"}
          </button>
        </div>

        <div className="mt-8 flex gap-4">
          <Link href="/dashboard" className="text-slate-300 underline">
            ← Back to Dashboard
          </Link>
          <Link href="/quick-start" className="text-slate-300 underline">
            Quick Start →
          </Link>
        </div>
      </section>
    </main>
  );
}
