// src/app/connect-keys/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const COINBASE_REF_PATH = "/go/coinbase";

type StepState = "todo" | "active" | "done";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function Pill({
  label,
  state,
}: {
  label: string;
  state: StepState;
}) {
  const cls =
    state === "done"
      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25"
      : state === "active"
      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25"
      : "bg-slate-800/60 text-slate-300 ring-1 ring-slate-700/50";

  const dot =
    state === "done"
      ? "bg-emerald-400"
      : state === "active"
      ? "bg-amber-300"
      : "bg-slate-500";

  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs", cls)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function PrimaryButton({
  children,
  href,
  onClick,
  target,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  target?: string;
}) {
  const classes =
    "inline-flex w-full items-center justify-center rounded-full bg-yellow-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-yellow-300 active:bg-yellow-200 transition-colors";

  if (href) {
    return (
      <a className={classes} href={href} target={target} rel={target === "_blank" ? "noreferrer" : undefined}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900/40 transition-colors"
    >
      {children}
    </Link>
  );
}

export default function ConnectKeysPage() {
  // Basic local UX state (not security). Real verification comes later via server check.
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<"idle" | "bad" | "ok" | "saving">("idle");
  const [msg, setMsg] = useState<string>("");

  const step1: StepState = "done"; // user is already on this page
  const step2: StepState = "active";
  const step3: StepState = useMemo(() => {
    const ready = keyName.trim() && keyId.trim() && secret.trim();
    if (status === "ok") return "done";
    return ready ? "active" : "todo";
  }, [keyName, keyId, secret, status]);

  // Gentle “come back to this tab” helper after opening Coinbase
  useEffect(() => {
    function onFocus() {
      // When user returns to this tab, show a tiny nudge if they haven’t filled fields yet.
      if (!keyId && !secret) setCopied(false);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [keyId, secret]);

  function validateInputs() {
    if (!keyName.trim() || !keyId.trim() || !secret.trim()) {
      setStatus("bad");
      setMsg("Paste all 3 values from Coinbase: Key Name, Key ID, and Secret.");
      return false;
    }
    if (keyId.trim().length < 10) {
      setStatus("bad");
      setMsg("That Key ID looks too short. Double-check you copied the full Key ID.");
      return false;
    }
    if (secret.trim().length < 10) {
      setStatus("bad");
      setMsg("That Secret looks too short. Double-check you copied the full Secret.");
      return false;
    }
    return true;
  }

  async function onVerify() {
    setMsg("");
    if (!validateInputs()) return;

    try {
      setStatus("saving");

      // NOTE: This is intentionally *not* showing/echoing secrets.
      // Replace this call with your real save route when ready.
      // For now: simulate success so UX can be tested end-to-end.
      await new Promise((r) => setTimeout(r, 650));

      setStatus("ok");
      setMsg("Saved. Next: go back to Dashboard to confirm your setup state.");
    } catch (e: any) {
      setStatus("bad");
      setMsg(e?.message || "Could not save. Please try again.");
    }
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-950 via-slate-950 to-black">
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/60 px-3 py-1 text-xs text-slate-200 ring-1 ring-slate-800">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            SECURE SETUP
          </div>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">
            Connect Coinbase in <span className="text-sky-300">under 5 minutes</span>.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Follow the steps below. <span className="font-semibold text-slate-100">Green lights mean you’re done.</span>
            <br />
            <span className="text-slate-400">
              Tip: When you open Coinbase, keep this tab open. You’ll come back here to paste the values.
            </span>
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Pill label="COINBASE" state={step1} />
            <Pill label="ACCESS KEYS" state={step2} />
            <Pill label="VERIFY" state={step3} />
          </div>
        </div>

        {/* WHY */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-white">✅ Why this step exists (1 minute)</h2>
          <p className="mt-2 text-slate-300">
            YieldCraft does <span className="font-semibold text-slate-100">not</span> log into your Coinbase account and{" "}
            <span className="font-semibold text-slate-100">cannot</span> move your money.
          </p>
          <p className="mt-2 text-slate-300">
            Coinbase gives you Secure Access Keys that let YieldCraft:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>✅ View balances</li>
            <li>✅ Place trades (if you later arm trading)</li>
            <li>❌ Withdraw funds</li>
            <li>❌ Transfer money off Coinbase</li>
          </ul>

          <div className="mt-5">
            <PrimaryButton href={COINBASE_REF_PATH} target="_blank">
              Continue — open Coinbase API Settings (opens new tab) →
            </PrimaryButton>
            <p className="mt-2 text-xs text-slate-400">
              After you create the key on Coinbase, come back to <span className="font-semibold">this</span> YieldCraft tab and paste it into Step 3.
            </p>
          </div>
        </div>

        {/* STEP 1 */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/30 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🏦 Step 1: Choose the Coinbase account</h3>
              <p className="mt-1 text-sm text-slate-300">
                Use a separate Coinbase account for bots if you want clean reporting. Using an existing account is fine too.
              </p>
            </div>
            <div className="text-xs text-slate-400">Choose one (both work)</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
              <div className="text-xs font-semibold text-emerald-200">✅ Recommended</div>
              <div className="mt-1 text-xl font-bold text-white">Separate account for bots</div>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                <li>• Cleaner reporting & taxes</li>
                <li>• No accidental interference</li>
                <li>• Easier performance tracking</li>
              </ul>
              <div className="mt-4">
                <PrimaryButton href={COINBASE_REF_PATH} target="_blank">
                  Create / Sign up on Coinbase →
                </PrimaryButton>
                <p className="mt-2 text-xs text-slate-400">
                  Coinbase opens in a new tab so you don’t lose your place here.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
              <div className="text-xs font-semibold text-slate-200">Already use Coinbase?</div>
              <div className="mt-1 text-xl font-bold text-white">Use existing account</div>
              <p className="mt-3 text-sm text-slate-300">
                Works great if this is not your long-term “core fund” account — or you’re okay with combined reporting.
              </p>
              <div className="mt-4">
                <PrimaryButton href={COINBASE_REF_PATH} target="_blank">
                  Sign in to Coinbase →
                </PrimaryButton>
                <p className="mt-2 text-xs text-slate-400">
                  Sign in, then come back here to create the key.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/30 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🔑 Step 2: Create Secure Access Keys</h3>
              <p className="mt-1 text-sm text-slate-300">
                Inside Coinbase, create an API key with <span className="font-semibold text-slate-100">View + Trade</span> only.
                Leave withdraw/transfer off.
              </p>
            </div>
            <div className="text-xs text-slate-400">We’ll guide you (no jargon)</div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
            <div className="text-sm font-semibold text-slate-100">What you’ll do next (30 seconds)</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>Open Coinbase <span className="font-semibold text-slate-100">Settings</span></li>
              <li>Go to <span className="font-semibold text-slate-100">API</span> (or “API Keys”)</li>
              <li>Click <span className="font-semibold text-slate-100">Create API Key</span></li>
              <li>Enable only: <span className="font-semibold text-slate-100">View + Trade</span> (leave withdrawals OFF)</li>
            </ol>
            <p className="mt-3 text-xs text-slate-400">
              Coinbase layout can vary — that’s okay. The important part is permissions: View + Trade only.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
            <div className="text-sm font-semibold text-slate-100">Use these exact settings:</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>✅ Permissions: <span className="font-semibold text-slate-100">View + Trade</span></li>
              <li>❌ Withdrawals: <span className="font-semibold text-slate-100">Disabled</span></li>
              <li>📁 Portfolio: <span className="font-semibold text-slate-100">Primary</span></li>
              <li>🌐 IP restrictions: <span className="font-semibold text-slate-100">None</span> (for now)</li>
            </ul>

            <div className="mt-5">
              <PrimaryButton href={COINBASE_REF_PATH} target="_blank">
                Open Coinbase API Settings → (new tab)
              </PrimaryButton>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/30 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🔒 Step 3: Paste & verify</h3>
              <p className="mt-1 text-sm text-slate-300">
                Important: connecting keys <span className="font-semibold text-slate-100">does not</span> start trading.
                Trading stays OFF until you explicitly arm it.
              </p>
            </div>
            <div className="text-xs text-slate-400">Paste → Verify → Confidence</div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
            <label className="block text-xs font-semibold text-slate-200">API Key Name</label>
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., YieldCraft"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
            />

            <label className="mt-4 block text-xs font-semibold text-slate-200">API Key ID</label>
            <input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="Paste Key ID"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
            />

            <div className="mt-4 flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">API Secret</label>
              <button
                type="button"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                onClick={() => setShowSecret((s) => !s)}
              >
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>

            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste Secret"
              type={showSecret ? "text" : "password"}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
            />

            <p className="mt-2 text-xs text-slate-400">
              We never display this back to you. Store it safely.
            </p>

            <div className="mt-5">
              <PrimaryButton onClick={onVerify}>
                {status === "saving" ? "Verifying..." : "Verify & Continue"}
              </PrimaryButton>

              {msg ? (
                <div
                  className={cx(
                    "mt-3 rounded-xl px-4 py-3 text-sm ring-1",
                    status === "ok"
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20"
                      : status === "bad"
                      ? "bg-rose-500/10 text-rose-200 ring-rose-500/20"
                      : "bg-slate-800/30 text-slate-200 ring-slate-700/40"
                  )}
                >
                  {msg}
                </div>
              ) : null}

              <p className="mt-3 text-xs text-slate-400">
                Next upgrade: add a safe server-side verification (read-only) so your dashboard can show{" "}
                <span className="font-semibold text-slate-200">“YOUR COINBASE: GREEN”</span>.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <SecondaryButton href="/dashboard">← Back to Dashboard</SecondaryButton>
            <SecondaryButton href="/quick-start">Quick Start</SecondaryButton>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            YieldCraft provides software tools for structured workflows. Not investment advice. Trading involves risk, including possible loss of capital.
          </p>
        </div>
      </section>
    </main>
  );
}
