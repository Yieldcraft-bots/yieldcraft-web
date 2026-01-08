"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/**
 * ConnectKeysPage (Coinbase CDP)
 * - Explains Coinbase's copy buttons (little copy icon next to each value)
 * - Uses Coinbase CDP fields:
 *    1) API Key Name (organizations/.../apiKeys/...)
 *    2) Private Key (PEM block)
 * - Calls POST /api/connect-keys to verify + store encrypted per user
 *
 * SECURITY NOTE:
 * - YieldCraft cannot withdraw funds.
 * - Trading stays OFF until the user explicitly enables it elsewhere.
 */

type Status = "idle" | "verifying" | "ok" | "error";

export default function ConnectKeysPage() {
  const [label, setLabel] = useState("Coinbase");

  const [apiKeyName, setApiKeyName] = useState(""); // organizations/.../apiKeys/...
  const [privateKeyPem, setPrivateKeyPem] = useState(""); // PEM block
  const [showPem, setShowPem] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [verifiedAt, setVerifiedAt] = useState("");

  const [userId, setUserId] = useState("");

  // If you have a real auth source, replace this.
  useEffect(() => {
    try {
      const id =
        window.localStorage.getItem("yc_user_id") ||
        window.localStorage.getItem("user_id") ||
        "";
      setUserId(id);
    } catch {
      setUserId("");
    }
  }, []);

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  const looksLikeApiKeyName = useMemo(() => {
    const v = apiKeyName.trim();
    return v.startsWith("organizations/") && v.includes("/apiKeys/");
  }, [apiKeyName]);

  const looksLikePem = useMemo(() => {
    const v = privateKeyPem.trim();
    return v.includes("BEGIN") && v.includes("PRIVATE KEY") && v.includes("END");
  }, [privateKeyPem]);

  function setError(msg: string) {
    setStatus("error");
    setErrorMsg(msg);
  }

  async function pasteFromClipboard(into: "apiKeyName" | "privateKeyPem") {
    setErrorMsg("");
    try {
      if (!navigator.clipboard?.readText) {
        setError("Clipboard not available in this browser. Please paste manually.");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        setError("Clipboard is empty. Click the copy button in Coinbase first, then click Paste here.");
        return;
      }
      if (into === "apiKeyName") setApiKeyName(text.trim());
      if (into === "privateKeyPem") setPrivateKeyPem(text);
      setStatus("idle");
    } catch {
      setError(
        "Paste blocked by browser permissions. Click inside the field and press Ctrl+V (or Cmd+V on Mac)."
      );
    }
  }

  async function verifyAndContinue() {
    setErrorMsg("");
    setVerifiedAt("");

    if (!userId) {
      setError("You must be logged in to connect Coinbase. Please log in and try again.");
      return;
    }

    if (!apiKeyName.trim()) {
      setError("Paste your API Key Name from Coinbase (the organizations/.../apiKeys/... value).");
      return;
    }

    if (!privateKeyPem.trim()) {
      setError("Paste your Private Key from Coinbase (the block that starts with -----BEGIN PRIVATE KEY-----).");
      return;
    }

    // Gentle validation (so users know immediately if they copied the wrong thing)
    if (!looksLikeApiKeyName) {
      setError(
        "That API Key Name doesn’t look right. Go back to Coinbase and click the small copy icon next to “API key name”. It usually starts with organizations/…/apiKeys/…"
      );
      return;
    }

    if (!looksLikePem) {
      setError(
        "That Private Key doesn’t look right. It must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----. Click the small copy icon next to “Private key” in Coinbase."
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
          user_id: userId,
          label: label || "Coinbase",
          coinbase_api_key_name: apiKeyName.trim(),
          coinbase_private_key: privateKeyPem,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(
          data?.error ||
            `Verify failed (HTTP ${res.status}). Double-check: (1) View + Trade permissions, (2) you copied “API key name” + “Private key” using Coinbase’s copy buttons.`
        );
        return;
      }

      setStatus("ok");
      setVerifiedAt(data?.verified_at || new Date().toISOString());
    } catch (e: any) {
      setError(String(e?.message || e || "Verify failed"));
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
          <span className="text-xs text-slate-400">No withdrawals. View + trade only.</span>
        </div>

        <h1 className="text-3xl font-bold text-white">
          Connect Coinbase in{" "}
          <span className="bg-gradient-to-r from-sky-300 to-cyan-200 bg-clip-text text-transparent">
            under 5 minutes
          </span>
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          This verifies your Coinbase connection. <span className="text-slate-200">Trading stays OFF</span> until you
          explicitly enable it.
        </p>

        {/* STEP 1 */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">✅ Step 1: Open Coinbase API Key Settings</p>

          <a
            href={coinbaseApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0"
          >
            <span className="mr-2">Open Coinbase API Key Settings</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>

          <p className="mt-2 text-center text-xs text-slate-400">Opens in a new tab. Come back here after creating the key.</p>
        </div>

        {/* STEP 2 */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">🧩 Step 2: Create the key (exact checkboxes)</p>

          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-slate-100">1)</span> Click <span className="font-semibold text-slate-100">Create API key</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">2)</span> Portfolio: choose{" "}
              <span className="font-semibold text-slate-100">Primary</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">3)</span> Permissions: check{" "}
              <span className="font-semibold text-slate-100">View</span> and{" "}
              <span className="font-semibold text-slate-100">Trade</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">4)</span> Do{" "}
              <span className="font-semibold text-rose-200">NOT</span> enable{" "}
              <span className="font-semibold text-rose-200">Transfer</span>.
            </li>
            <li>
              <span className="font-semibold text-slate-100">5)</span> IP whitelist:{" "}
              <span className="font-semibold text-slate-100">leave blank</span> unless you know exactly what you’re doing.
            </li>
          </ol>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
            <div className="font-semibold text-slate-200">Important</div>
            <div className="mt-2 text-slate-400">
              Coinbase will show your credentials with a <span className="font-semibold text-slate-200">small copy icon</span>{" "}
              (looks like two squares) next to each value.{" "}
              <span className="text-slate-200">Click the copy icon</span> — don’t try to drag-select the text.
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <p className="font-semibold text-white">🔐 Step 3: Copy from Coinbase → Paste here → Verify</p>

          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
            <div className="font-semibold text-slate-200">Exactly what to copy</div>
            <ul className="mt-2 space-y-1 text-slate-400">
              <li>
                • <span className="text-slate-200">API Key Name</span> (starts with{" "}
                <span className="font-mono text-slate-300">organizations/</span>)
              </li>
              <li>
                • <span className="text-slate-200">Private key</span> (starts with{" "}
                <span className="font-mono text-slate-300">-----BEGIN PRIVATE KEY-----</span>)
              </li>
            </ul>
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional) — e.g. Coinbase"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
            />

            {/* API Key Name row */}
            <div className="flex gap-2">
              <input
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="Paste API Key Name (organizations/.../apiKeys/...)"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
              />
              <button
                type="button"
                onClick={() => pasteFromClipboard("apiKeyName")}
                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                title="Click Coinbase copy icon first, then click here"
              >
                Paste
              </button>
            </div>

            {/* Private key row */}
            <div className="relative">
              <textarea
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                placeholder="Paste Private Key (PEM) — starts with -----BEGIN PRIVATE KEY-----"
                rows={showPem ? 8 : 5}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 pr-28 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                style={{ WebkitTextSecurity: showPem ? "none" : "disc" } as any}
              />
              <div className="absolute right-3 top-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => pasteFromClipboard("privateKeyPem")}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                  title="Click Coinbase copy icon first, then click here"
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => setShowPem((s) => !s)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200 transition hover:bg-white/[0.07]"
                >
                  {showPem ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Coinbase shows the private key once. Paste it here immediately. YieldCraft stores it{" "}
              <span className="text-slate-300">encrypted</span> and you can revoke it anytime in Coinbase.
            </p>
          </div>

          {status === "error" && (
            <p className="mt-4 text-sm text-rose-300">{errorMsg || "Verify failed."}</p>
          )}

          {status === "ok" && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <div className="font-semibold">✔ Verified. Coinbase is connected.</div>
              <div className="mt-1 text-xs text-emerald-200/80">
                Trading is still OFF. {verifiedAt ? `Verified: ${verifiedAt}` : ""}
              </div>
            </div>
          )}

          <button
            onClick={verifyAndContinue}
            disabled={status === "verifying"}
            className="group mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-500/10 transition hover:-translate-y-[1px] hover:shadow-sky-500/20 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="mr-2">{status === "verifying" ? "Verifying..." : "Verify & Continue"}</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>

          <p className="mt-3 text-xs text-slate-500">
            This step only checks permissions + connectivity. It does not place trades.
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
          YieldCraft provides software tools only. Not investment advice. Trading involves risk, including loss of capital.
        </p>
      </section>
    </main>
  );
}
