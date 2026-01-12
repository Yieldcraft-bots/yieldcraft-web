// src/app/connect-keys/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Status = "idle" | "verifying" | "ok" | "error";

function isProbablyOrgPath(v: string) {
  return /^organizations\/.+/i.test((v || "").trim());
}

function isProbablyPem(v: string) {
  const s = (v || "").trim();
  return s.includes("BEGIN") && s.includes("PRIVATE KEY");
}

export default function ConnectKeysPage() {
  const router = useRouter();

  const [label, setLabel] = useState("Coinbase");
  const [apiKeyName, setApiKeyName] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [showPem, setShowPem] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  const canSubmit = useMemo(() => {
    if (!apiKeyName.trim() || !privateKeyPem.trim()) return false;
    if (!isProbablyOrgPath(apiKeyName)) return false;
    if (!isProbablyPem(privateKeyPem)) return false;
    return true;
  }, [apiKeyName, privateKeyPem]);

  // Require login (so we can send Bearer token for multi-user)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) router.replace("/login");
    })();
  }, [router]);

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
    if (!isProbablyOrgPath(apiKeyName)) {
      setStatus("error");
      setErrorMsg("API Key Name must start with organizations/…");
      return;
    }
    if (!isProbablyPem(privateKeyPem)) {
      setStatus("error");
      setErrorMsg("Private key must look like a PEM block (BEGIN PRIVATE KEY).");
      return;
    }

    setStatus("verifying");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";

      if (!token) {
        setStatus("error");
        setErrorMsg("Not signed in. Please log in again.");
        router.replace("/login");
        return;
      }

      // ✅ IMPORTANT: send Bearer token so server can resolve user_id (multi-user fix)
      const res = await fetch("/api/coinbase/save-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        body: JSON.stringify({
          label: label.trim() || "Coinbase",
          api_key_name: apiKeyName.trim(),
          private_key: privateKeyPem.trim(),
        }),
      });

      const dataRes = await res.json().catch(() => null);

      if (!res.ok || !dataRes?.ok) {
        setStatus("error");
        setErrorMsg(
          dataRes?.error ||
            dataRes?.reason ||
            `Verification failed (HTTP ${res.status}).`
        );
        return;
      }

      setStatus("ok");
      // back to dashboard so it can re-check status
      router.replace("/dashboard");
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

        {/* STEP 2 */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">
            Step 2: Copy from Coinbase (IMPORTANT)
          </p>

          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Coinbase will show each value with a small{" "}
              <span className="font-semibold text-white">copy icon ⧉</span> on
              the right.
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
          <p className="font-semibold text-white">Step 3: Paste below and verify</p>

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
              placeholder="Paste API Key Name here (organizations/...)"
            />

            <textarea
              value={privateKeyPem}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              rows={showPem ? 6 : 4}
              className="w-full rounded-xl bg-slate-950/40 px-4 py-3 text-white"
              placeholder="Paste Private Key here"
              spellCheck={false}
              style={{ WebkitTextSecurity: showPem ? "none" : "disc" } as any}
            />

            <button
              type="button"
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
              ✔ Coinbase connected. Returning to dashboard…
            </p>
          )}

          <button
            onClick={verifyAndContinue}
            disabled={!canSubmit || status === "verifying"}
            className={[
              "mt-6 w-full rounded-full px-6 py-3 font-semibold",
              !canSubmit || status === "verifying"
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950",
            ].join(" ")}
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
