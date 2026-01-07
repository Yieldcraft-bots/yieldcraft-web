// src/app/connect-keys/page.tsx
"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

const COINBASE_API_SETTINGS_URL = "https://www.coinbase.com/settings/api";
const COINBASE_SIGNIN_URL = "https://login.coinbase.com/signin";
const COINBASE_SIGNUP_URL = "https://www.coinbase.com/signup";

type Status = "idle" | "ok" | "warn" | "bad" | "checking";

function cx(...v: Array<string | false | undefined | null>) {
  return v.filter(Boolean).join(" ");
}

function Pill({ label, status }: { label: string; status: Status }) {
  const s = useMemo(() => {
    switch (status) {
      case "ok":
        return {
          wrap: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30",
          dot: "bg-emerald-400",
        };
      case "warn":
        return {
          wrap: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30",
          dot: "bg-amber-400",
        };
      case "bad":
        return {
          wrap: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30",
          dot: "bg-rose-400",
        };
      case "checking":
        return {
          wrap: "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30",
          dot: "bg-sky-400 animate-pulse",
        };
      default:
        return {
          wrap: "bg-slate-800/40 text-slate-200 ring-1 ring-slate-700/40",
          dot: "bg-slate-400",
        };
    }
  }, [status]);

  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", s.wrap)}>
      <span className={cx("h-2 w-2 rounded-full", s.dot)} />
      {label}
    </span>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {right}
      </div>
      <div className="text-sm text-slate-200/90">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  href,
  target,
  rel,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
}) {
  const base =
    "w-full rounded-full bg-[#f5b800] px-6 py-4 text-center text-sm font-semibold text-black transition hover:brightness-110 active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b800]/60";
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={cx(base, className)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cx(base, className)}>
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
      className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-6 py-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
    >
      {children}
    </Link>
  );
}

function openNewTab(url: string) {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
}

export default function ConnectKeysPage() {
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);

  const [coinbaseStatus, setCoinbaseStatus] = useState<Status>("idle");
  const [keysStatus, setKeysStatus] = useState<Status>("idle");
  const [verifyStatus, setVerifyStatus] = useState<Status>("idle");

  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "bad"; text: string } | null>(null);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markProgressAfterOpenCoinbase() {
    setCoinbaseStatus("ok");
    setKeysStatus("warn");
    setVerifyStatus("idle");
    setMsg({
      kind: "warn",
      text: "Coinbase opened in a new tab. Next: create an API key (View + Trade only), then come back here to paste it in Step 3.",
    });
    setTimeout(() => scrollTo(step2Ref), 150);
  }

  function openCoinbaseSignIn() {
    openNewTab(COINBASE_SIGNIN_URL);
    markProgressAfterOpenCoinbase();
  }

  function openCoinbaseSignUp() {
    openNewTab(COINBASE_SIGNUP_URL);
    markProgressAfterOpenCoinbase();
  }

  function openCoinbaseApiSettings() {
    // This should land directly on the API Key management page:
    // https://www.coinbase.com/settings/api
    openNewTab(COINBASE_API_SETTINGS_URL);
    setCoinbaseStatus("ok");
    setKeysStatus("checking");
    setVerifyStatus("idle");
    setMsg({
      kind: "warn",
      text: "You’re opening Coinbase API Key management now. If Coinbase ever redirects you to Home, go: See all → Settings → API.",
    });
    setTimeout(() => scrollTo(step3Ref), 250);
    setTimeout(() => setKeysStatus("warn"), 600);
  }

  function verifyAndContinue() {
    setMsg(null);

    if (!apiKeyName.trim() || !apiKeyId.trim() || !apiSecret.trim()) {
      setVerifyStatus("bad");
      setMsg({ kind: "bad", text: "Please paste all three values: API Key Name, API Key ID, and API Secret." });
      return;
    }

    // Frontend-only verification (format / presence). We do NOT contact Coinbase here.
    // Server-side validation is a future upgrade.
    if (apiKeyId.trim().length < 10 || apiSecret.trim().length < 10) {
      setVerifyStatus("warn");
      setMsg({
        kind: "warn",
        text: "Those values look shorter than expected. Double-check you copied the full Key ID + Secret from Coinbase (you usually only see the Secret once).",
      });
      return;
    }

    setVerifyStatus("ok");
    setKeysStatus("ok");
    setCoinbaseStatus("ok");
    setMsg({
      kind: "ok",
      text: "Looks good. Next step is server-side verification (read-only) so your dashboard can show “YOUR COINBASE: GREEN.”",
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black">
      <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            SECURE SETUP
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Connect Coinbase <span className="text-sky-300">in under 5 minutes.</span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Follow the steps below. <span className="font-semibold text-slate-100">Green lights mean you’re done.</span>
            <br />
            Tip: When Coinbase opens, keep this YieldCraft tab open — you’ll come back here to paste the values.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Pill label="COINBASE" status={coinbaseStatus} />
            <Pill label="ACCESS KEYS" status={keysStatus} />
            <Pill label="VERIFY" status={verifyStatus} />
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Why this step exists (1 minute)">
            <p className="text-slate-200">
              YieldCraft does <span className="font-semibold text-white">not</span> log into your Coinbase account and{" "}
              <span className="font-semibold text-white">cannot</span> move your money.
            </p>

            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-emerald-300">✅</span> View balances
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-300">✅</span> Place trades (only if you later arm trading)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-300">❌</span> Withdraw funds
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-300">❌</span> Transfer money off Coinbase
              </div>
            </div>

            <div className="mt-5">
              <PrimaryButton onClick={openCoinbaseApiSettings}>
                Continue — open Coinbase API Key management (opens new tab) →
              </PrimaryButton>
              <p className="mt-3 text-xs text-slate-300">
                If Coinbase ever opens to Home, do this inside Coinbase:
                <span className="font-semibold text-white"> See all → Settings → API</span>
              </p>
            </div>
          </Card>

          <div ref={step2Ref} />

          <Card
            title="Step 1: Choose the Coinbase account"
            right={<span className="text-xs text-slate-400">Choose one (both work)</span>}
          >
            <p className="text-slate-300">
              Use a separate Coinbase account for bots if you want clean reporting. Using an existing account is fine too.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-200">
                  <span className="text-emerald-300">✅</span> Recommended
                </div>
                <div className="text-lg font-semibold text-slate-100">Separate account for bots</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>• Cleaner reporting & taxes</li>
                  <li>• No accidental interference</li>
                  <li>• Easier performance tracking</li>
                </ul>
                <div className="mt-4">
                  <PrimaryButton onClick={openCoinbaseSignUp}>Create / Sign up on Coinbase →</PrimaryButton>
                  <p className="mt-2 text-xs text-slate-400">
                    Coinbase opens in a new tab so you don’t lose your place here.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <div className="text-xs font-semibold text-slate-300">Already use Coinbase?</div>
                <div className="mt-1 text-lg font-semibold text-slate-100">Use existing account</div>
                <p className="mt-3 text-sm text-slate-300">
                  Works great if this is not your long-term “core fund” account — or you’re okay with combined reporting.
                </p>
                <div className="mt-4">
                  <PrimaryButton onClick={openCoinbaseSignIn}>Sign in to Coinbase →</PrimaryButton>
                  <p className="mt-2 text-xs text-slate-400">Sign in, then come back here to create the key.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Step 2: Create Secure Access Keys"
            right={<span className="text-xs text-slate-400">We’ll guide you (no jargon)</span>}
          >
            <p className="text-slate-300">
              Inside Coinbase, create an API key with <span className="font-semibold text-white">View + Trade only</span>.
              Leave withdraw/transfer off.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
              <div className="text-sm font-semibold text-slate-100">What you’ll do next (30 seconds)</div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                <li>Open Coinbase Settings</li>
                <li>Go to API (or “API Keys”)</li>
                <li>Click Create API key</li>
                <li>
                  Enable only: <span className="font-semibold text-white">View + Trade</span> (leave withdrawals OFF)
                </li>
              </ol>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
              <div className="text-sm font-semibold text-slate-100">Use these exact settings:</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300">✅</span> Permissions: <span className="font-semibold">View + Trade</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-rose-300">❌</span> Withdrawals: <span className="font-semibold">Disabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-300">🗂️</span> Portfolio: <span className="font-semibold">Primary</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-300">🌐</span> IP restrictions: <span className="font-semibold">None (for now)</span>
                </div>
              </div>

              <div className="mt-4">
                <PrimaryButton onClick={openCoinbaseApiSettings}>Open Coinbase API Key management → (new tab)</PrimaryButton>
                <p className="mt-3 text-xs text-slate-300">
                  This should land directly on{" "}
                  <span className="font-semibold text-white">API Key management</span>. If it doesn’t, inside Coinbase go{" "}
                  <span className="font-semibold text-white">See all → Settings → API</span>.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              After you create the key, Coinbase shows a Key Name, Key ID, and Secret. Copy them once — then come back here
              for Step 3.
            </p>
          </Card>

          <div ref={step3Ref} />

          <Card
            title="Step 3: Paste & verify"
            right={<span className="text-xs text-slate-400">Paste → Verify → Confidence</span>}
          >
            <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Important:</span> connecting keys does not start trading. Trading stays{" "}
              <span className="font-semibold text-white">OFF</span> until you explicitly arm it.
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">API Key Name</label>
                <input
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  placeholder="e.g., YieldCraft"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">API Key ID</label>
                <input
                  value={apiKeyId}
                  onChange={(e) => setApiKeyId(e.target.value)}
                  placeholder="Paste Key ID"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">API Secret</label>
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                  >
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  type={showSecret ? "text" : "password"}
                  placeholder="Paste Secret"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                />
                <p className="mt-2 text-xs text-slate-400">
                  We never display this back to you. Store it safely.
                </p>
              </div>

              {msg ? (
                <div
                  className={cx(
                    "rounded-2xl border p-4 text-sm",
                    msg.kind === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                    msg.kind === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-100",
                    msg.kind === "bad" && "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  )}
                >
                  {msg.text}
                </div>
              ) : null}

              <PrimaryButton onClick={verifyAndContinue}>Verify & Continue</PrimaryButton>

              <p className="text-xs text-slate-400">
                Next upgrade: add a safe server-side verification (read-only) so your dashboard can show{" "}
                <span className="font-semibold text-slate-100">“YOUR COINBASE: GREEN”</span>.
              </p>
            </div>
          </Card>

          <Card title="What happens after this">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <div className="text-sm font-semibold text-slate-100">Pulse (Active)</div>
                <p className="mt-2 text-sm text-slate-300">
                  Starts disarmed by default. Rules-based execution.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
                <div className="text-sm font-semibold text-slate-100">Atlas (Long-Term / DCA)</div>
                <p className="mt-2 text-sm text-slate-300">
                  Uses the same connection. No extra setup later.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <SecondaryButton href="/dashboard">← Back to Dashboard</SecondaryButton>
              <SecondaryButton href="/quick-start">Quick Start</SecondaryButton>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              YieldCraft provides software tools for structured workflows. Not investment advice. Trading involves risk,
              including possible loss of capital.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
