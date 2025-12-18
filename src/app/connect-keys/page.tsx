// src/app/connect-keys/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

// Server-side referral redirect you already created
const COINBASE_REF_PATH = "/go/coinbase";

type Status = "idle" | "ok" | "warn" | "bad" | "checking";

function Pill({ label, status }: { label: string; status: Status }) {
  const s = useMemo(() => {
    switch (status) {
      case "ok":
        return {
          wrap: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30",
          dot: "bg-emerald-400",
          text: "GREEN",
        };
      case "warn":
        return {
          wrap: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30",
          dot: "bg-amber-300",
          text: "YELLOW",
        };
      case "bad":
        return {
          wrap: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30",
          dot: "bg-rose-400",
          text: "RED",
        };
      case "checking":
        return {
          wrap: "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700",
          dot: "bg-slate-300",
          text: "CHECKING",
        };
      default:
        return {
          wrap: "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700",
          dot: "bg-slate-300",
          text: "—",
        };
    }
  }, [status]);

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
        s.wrap,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", s.dot].join(" ")} />
      {label}: {s.text}
    </span>
  );
}

function ExternalButton({
  href,
  children,
  onClick,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 hover:bg-amber-300"
      : "inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/40 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/70";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={cls}
    >
      {children}
    </a>
  );
}

export default function ConnectKeysPage() {
  // Step tracking (for “guided page” success rate)
  const [accountChoice, setAccountChoice] = useState<"none" | "new" | "existing">(
    "none"
  );

  // API fields (client-side only; no storage in this file)
  const [keyName, setKeyName] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Status lights
  const [coinbaseStep, setCoinbaseStep] = useState<Status>("idle"); // Step 1
  const [apiStep, setApiStep] = useState<Status>("idle"); // Step 2
  const [verifyStep, setVerifyStep] = useState<Status>("idle"); // Step 3

  const [message, setMessage] = useState<string | null>(null);

  function chooseAccount(which: "new" | "existing") {
    setAccountChoice(which);
    setCoinbaseStep("ok");
    // Nudge next step visually
    setApiStep((s) => (s === "idle" ? "warn" : s));
    setMessage(null);
  }

  function openedApiSettings() {
    setApiStep("ok");
    // Nudge verify step visually
    setVerifyStep((s) => (s === "idle" ? "warn" : s));
    setMessage(null);
  }

  async function onVerify() {
    setMessage(null);

    if (!keyName.trim() || !keyId.trim() || !keySecret.trim()) {
      setVerifyStep("warn");
      setMessage("Please paste all three fields (Key Name, Key ID, and Secret).");
      return;
    }

    const looksLikeId = keyId.trim().length >= 10;
    const looksLikeSecret = keySecret.trim().length >= 10;

    if (!looksLikeId || !looksLikeSecret) {
      setVerifyStep("bad");
      setMessage(
        "Those values look incomplete. Re-copy the Key ID and Secret from Coinbase and try again."
      );
      return;
    }

    setVerifyStep("ok");
    setMessage(
      "Looks good ✅ Next: we’ll add a safe server-side verification (read-only) so the dashboard can show “EXCHANGE KEYS: GREEN”."
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
              Secure Setup
            </span>

            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Connect Coinbase in{" "}
              <span className="text-sky-300">under 5 minutes</span>.
            </h1>

            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Follow the steps below.{" "}
              <span className="font-semibold text-slate-100">
                Green lights mean you’re done.
              </span>
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <Pill label="COINBASE" status={coinbaseStep} />
              <Pill label="API KEY" status={apiStep} />
              <Pill label="VERIFY" status={verifyStep} />
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
          {/* SAFETY */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
            <h2 className="text-lg font-semibold">🔒 Your funds stay on Coinbase</h2>
            <p className="mt-2 text-sm text-slate-300">
              YieldCraft connects using{" "}
              <span className="font-semibold text-slate-100">
                read + trade permissions only
              </span>
              .
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              <li>• ❌ We cannot withdraw funds</li>
              <li>• ❌ We cannot move money off Coinbase</li>
              <li>• ✅ You can disable access instantly from Coinbase</li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">
              This is the same permission model used by professional trading platforms.
            </p>
          </div>

          {/* STEP 1 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">🏦 Step 1: Coinbase account</h2>
              <span className="text-xs text-slate-400">Choose one (both work)</span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => chooseAccount("new")}
                className={[
                  "rounded-3xl border p-5 text-left transition",
                  accountChoice === "new"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/30 hover:border-slate-600",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-slate-50">✅ Recommended</p>
                <p className="mt-1 text-base font-semibold">Separate account for bots</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  <li>• Cleaner reporting & taxes</li>
                  <li>• No accidental interference</li>
                  <li>• Easier performance tracking</li>
                </ul>

                <div className="mt-4">
                  <ExternalButton
                    href={COINBASE_REF_PATH}
                    onClick={() => chooseAccount("new")}
                  >
                    Create Coinbase account →
                  </ExternalButton>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Tip: Click this first so Coinbase can attribute signup to YieldCraft.
                </p>
              </button>

              <button
                type="button"
                onClick={() => chooseAccount("existing")}
                className={[
                  "rounded-3xl border p-5 text-left transition",
                  accountChoice === "existing"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/30 hover:border-slate-600",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-slate-50">Already use Coinbase?</p>
                <p className="mt-1 text-base font-semibold">Use existing account</p>
                <p className="mt-3 text-sm text-slate-300">
                  Works great if you mainly hold long-term. If you actively trade, a
                  separate account is usually simpler.
                </p>

                <div className="mt-4">
                  <ExternalButton
                    href="https://www.coinbase.com/signin"
                    onClick={() => chooseAccount("existing")}
                  >
                    Sign in to Coinbase →
                  </ExternalButton>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">🔑 Step 2: Create your API key</h2>
              <span className="text-xs text-slate-400">Use these exact settings</span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
              <p className="text-sm font-semibold text-slate-100">
                Create ONE new API key with:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li>
                  • ✅ Permissions: <span className="font-semibold">View + Trade</span>
                </li>
                <li>
                  • ❌ Withdrawals: <span className="font-semibold">Disabled</span>
                </li>
                <li>
                  • 📁 Portfolio: <span className="font-semibold">Primary</span>
                </li>
                <li>
                  • 🌐 IP restrictions: <span className="font-semibold">None</span>
                </li>
              </ul>

              <div className="mt-5">
                <ExternalButton
                  href="https://www.coinbase.com/settings/api"
                  onClick={openedApiSettings}
                  variant="secondary"
                >
                  Open Coinbase API Settings →
                </ExternalButton>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Coinbase layout can vary. That’s okay — we verify in the next step.
              </p>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">🔐 Step 3: Paste & verify</h2>
              <span className="text-xs text-slate-400">Paste → Verify → Green</span>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-sm text-slate-200 mb-1">API Key Name</label>
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full rounded-2xl bg-slate-950/40 border border-slate-800 px-4 py-3 text-slate-50 outline-none focus:border-slate-500"
                  placeholder="e.g., YieldCraft"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-200 mb-1">API Key ID</label>
                <input
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  className="w-full rounded-2xl bg-slate-950/40 border border-slate-800 px-4 py-3 text-slate-50 outline-none focus:border-slate-500"
                  placeholder="Paste Key ID"
                  autoComplete="off"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-slate-200 mb-1">API Secret</label>
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="text-xs font-semibold text-slate-300 hover:text-slate-100"
                  >
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  type={showSecret ? "text" : "password"}
                  className="w-full rounded-2xl bg-slate-950/40 border border-slate-800 px-4 py-3 text-slate-50 outline-none focus:border-slate-500"
                  placeholder="Paste Secret"
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-slate-400">
                  We never display this back to you. Store it safely.
                </p>
              </div>

              {message && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-200">
                  {message}
                </div>
              )}

              <button
                type="button"
                onClick={onVerify}
                className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 hover:bg-amber-300"
              >
                Verify & Connect
              </button>

              <p className="text-xs text-slate-400">
                Next upgrade: add a safe server-side verification (read-only) so your dashboard can
                show “EXCHANGE KEYS: GREEN”.
              </p>
            </div>
          </div>

          {/* What’s next */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/25 p-6">
            <h2 className="text-lg font-semibold">🤖 What happens after this</h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <p className="text-sm font-semibold text-slate-100">Pulse (Active)</p>
                <p className="mt-1 text-sm text-slate-300">
                  Starts <span className="font-semibold">disarmed</span> by default. Rules-based
                  execution.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <p className="text-sm font-semibold text-slate-100">Atlas (Long-Term / DCA)</p>
                <p className="mt-1 text-sm text-slate-300">
                  Uses the <span className="font-semibold">same connection</span>. No extra setup
                  later.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
              >
                ← Back to Dashboard
              </Link>

              <Link
                href="/quick-start"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
              >
                Quick Start
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              YieldCraft provides software tools for structured workflows. Not investment advice.
              Trading involves risk, including possible loss of capital.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
