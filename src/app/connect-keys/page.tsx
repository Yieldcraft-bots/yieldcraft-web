// src/app/connect-keys/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Status = "idle" | "checking" | "verifying" | "ok" | "error";

function isProbablyOrgPath(v: string) {
  return /^organizations\/.+/i.test((v || "").trim());
}

function isProbablyPem(v: string) {
  const s = (v || "").trim();
  return s.includes("BEGIN") && s.includes("PRIVATE KEY");
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function ConnectKeysPage() {
  const router = useRouter();

  const [label, setLabel] = useState("Coinbase");
  const [apiKeyName, setApiKeyName] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [showPem, setShowPem] = useState(false);

  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  // Server-known connection state (does NOT expose the private key)
  const [existingConnected, setExistingConnected] = useState(false);
  const [existingAlg, setExistingAlg] = useState<string | null>(null);
  const [existingUpdatedAt, setExistingUpdatedAt] = useState<string | null>(null);
  const [existingReason, setExistingReason] = useState<string | null>(null);

  // If connected already, user must intentionally choose to replace
  const [replaceMode, setReplaceMode] = useState(false);

  const coinbaseApiUrl = "https://www.coinbase.com/settings/api";

  const canSubmit = useMemo(() => {
    if (!apiKeyName.trim() || !privateKeyPem.trim()) return false;
    if (!isProbablyOrgPath(apiKeyName)) return false;
    if (!isProbablyPem(privateKeyPem)) return false;
    return true;
  }, [apiKeyName, privateKeyPem]);

  // Require login + check if keys already exist (so user doesn’t think they must re-paste)
  useEffect(() => {
    (async () => {
      setErrorMsg("");
      setStatus("checking");

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const r = await fetch("/api/coinbase/status", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json().catch(() => null);

        const connected = !!(r.ok && j && j.connected === true);

        setExistingConnected(connected);
        setExistingAlg(j?.alg ?? null);
        setExistingUpdatedAt(j?.updated_at ?? null);
        setExistingReason(j?.reason ?? j?.error ?? null);

        // If already connected, default to safe “view” mode (don’t show empty inputs)
        setReplaceMode(!connected);
        setStatus("idle");
      } catch {
        // If status endpoint fails, we still allow user to paste keys
        setExistingConnected(false);
        setExistingAlg(null);
        setExistingUpdatedAt(null);
        setExistingReason("status_check_failed");
        setReplaceMode(true);
        setStatus("idle");
      }
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

      // Save keys for THIS user (multi-user safe)
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

      // Immediately re-check status so UI reflects “stored” truth
      const st = await fetch("/api/coinbase/status", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const sj = await st.json().catch(() => null);

      const connected = !!(st.ok && sj && sj.connected === true);
      setExistingConnected(connected);
      setExistingAlg(sj?.alg ?? null);
      setExistingUpdatedAt(sj?.updated_at ?? null);
      setExistingReason(sj?.reason ?? sj?.error ?? null);

      if (!connected) {
        setStatus("error");
        setErrorMsg(
          "Keys were saved, but Coinbase verification is still not green. Please re-check key permissions/scopes and try again."
        );
        return;
      }

      setStatus("ok");
      router.replace("/dashboard");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  const ConnectedPanel = (
    <div className="mt-8 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-6">
      <p className="font-semibold text-white">✅ Coinbase already connected</p>
      <p className="mt-2 text-sm text-emerald-100/90">
        You do <b>not</b> need to paste keys again. They are stored securely for your account.
      </p>

      <div className="mt-4 text-sm text-slate-200">
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            alg: <span className="font-mono">{existingAlg ?? "unknown"}</span>
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            updated: <span className="font-mono">{fmtDate(existingUpdatedAt)}</span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-white"
        >
          Go to Dashboard →
        </button>

        <button
          type="button"
          onClick={() => {
            setReplaceMode(true);
            setApiKeyName("");
            setPrivateKeyPem("");
            setShowPem(false);
            setStatus("idle");
            setErrorMsg("");
          }}
          className="rounded-full border border-white/20 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.10]"
        >
          Replace keys
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-white">Connect Coinbase in under 5 minutes</h1>

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

        {/* If already connected, show the “you’re good” panel instead of empty inputs */}
        {status === "checking" ? (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-slate-300">
            Checking your saved connection…
          </div>
        ) : existingConnected && !replaceMode ? (
          ConnectedPanel
        ) : null}

        {/* STEP 1 */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">Step 1: Open Coinbase API settings</p>

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
          <p className="font-semibold text-white">Step 2: Copy from Coinbase (IMPORTANT)</p>

          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Coinbase will show each value with a small{" "}
              <span className="font-semibold text-white">copy icon ⧉</span> on the right.
            </p>

            <p className="font-semibold text-emerald-300">👉 CLICK THE COPY ICON.</p>

            <p className="text-rose-300">❌ Do NOT highlight or drag-select the text.</p>

            <ul className="mt-3 list-disc pl-5">
              <li>
                Copy <b>API Key Name</b> (starts with{" "}
                <code className="text-sky-300">organizations/</code>)
              </li>
              <li>
                Copy <b>Private Key</b> (starts with{" "}
                <code className="text-sky-300">-----BEGIN PRIVATE KEY-----</code>)
              </li>
            </ul>
          </div>
        </div>

        {/* STEP 3 (only show form if replacing or not yet connected) */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <p className="font-semibold text-white">Step 3: Paste below and verify</p>

          {!existingConnected && existingReason ? (
            <p className="mt-2 text-xs text-slate-400">
              Status hint: <span className="font-mono">{existingReason}</span>
            </p>
          ) : null}

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

          {status === "error" && <p className="mt-3 text-sm text-rose-300">{errorMsg}</p>}

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
