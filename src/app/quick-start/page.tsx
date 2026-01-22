// src/app/quick-start/page.tsx
"use client";

import Link from "next/link";
import React, { useCallback } from "react";

const COINBASE_API_SETTINGS_URL = "https://www.coinbase.com/settings/api";
const COINBASE_SIGNUP_FALLBACK_URL = "https://www.coinbase.com/signup";

function getCoinbaseSignupUrl(): string {
  // If you set NEXT_PUBLIC_COINBASE_REF_URL in Vercel, this will use your affiliate/ref link.
  // The UI will NOT say "affiliate" anywhere.
  const v = process.env.NEXT_PUBLIC_COINBASE_REF_URL;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : COINBASE_SIGNUP_FALLBACK_URL;
}

export default function QuickStartPage() {
  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const coinbaseSignupUrl = getCoinbaseSignupUrl();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {/* HERO */}
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Quick Start Guide
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Join → Subscribe → Connect →{" "}
            <span className="text-sky-300">Confirm green lights</span>.
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            YieldCraft connects directly to your exchange using signed requests.
            <br />
            No third-party bridges. No “fund transfers.” No confusion.
          </p>

          {/* 5-minute strip */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  5-minute setup (click in order)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your path is simple:{" "}
                  <span className="text-slate-200">Plan → Coinbase → Connect → Dashboard</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => scrollToId("steps")}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/60"
              >
                Start here <span className="ml-2">→</span>
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MiniStep title="1) Plan" subtitle="Choose your tier" active />
              <MiniStep title="2) Coinbase" subtitle="API key setup" />
              <MiniStep title="3) Connect" subtitle="Paste keys securely" />
              <MiniStep title="4) Dashboard" subtitle="Watch green lights" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-slate-50">Important:</span> it’s normal to see{" "}
                <span className="text-sky-300 font-semibold">no trade</span> right away. Waiting is part of the strategy.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Your “proof” is the green lights + heartbeat confirmation — not an immediate order.
              </p>
            </div>
          </div>
        </div>

        {/* DISCIPLINE / FUNDING */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-sky-400 uppercase">
                The Discipline System
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold">
                Build a system for yourself — then let the bots go to work.
              </h2>
              <p className="mt-3 text-sm md:text-base text-slate-300">
                YieldCraft is designed to reward{" "}
                <span className="text-slate-50 font-semibold">consistency</span>, not impulse. We help you build a repeatable habit:
                <span className="text-slate-50 font-semibold"> pay yourself first</span>, contribute consistently, then let disciplined automation
                do what it’s built to do.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Consistency &gt; intensity</Pill>
              <Pill>Risk guardrails</Pill>
              <Pill>Never force trades</Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoTile
              title="Start small (yes, even $60)"
              text="YieldCraft supports small accounts. Smaller balances may trade less often — by design and exchange minimums."
            />
            <InfoTile
              title="Add a consistent amount"
              text="Many users choose a monthly contribution (like paying yourself first). It builds discipline and reduces emotional decision-making."
            />
            <InfoTile
              title="Let the engine wait"
              text="YieldCraft does not trade constantly. No trade is often a sign of discipline — not a problem."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">How sizing works:</span> YieldCraft reads your available balances from the exchange
              and constrains order sizes by available funds, exchange minimum order rules, and risk controls.{" "}
              <span className="text-slate-50 font-semibold">No leverage. No forced sizing.</span>
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="text-sm font-semibold text-sky-200">Best practice (recommended)</p>
            <p className="mt-1 text-xs text-slate-300">
              Use a dedicated Coinbase account or dedicated portfolio for bots. It keeps personal holdings separate and makes position tracking cleaner.
              If you already hold BTC in the same account, the system may detect an existing position when managing trades.
            </p>
          </div>
        </section>

        {/* STATUS LIGHTS */}
        <section className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Live status lights</h3>
              <p className="mt-1 text-sm text-slate-400">
                This is what “live” looks like even when there’s no signal yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Direct execution</Pill>
              <Pill>Risk guardrails</Pill>
              <Pill>Maker-first behavior</Pill>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StatusItem
              color="green"
              title="Connected"
              description="Exchange auth is valid and responding."
            />
            <StatusItem
              color="green"
              title="Engine Armed"
              description="Your plan is active and bots are enabled."
            />
            <StatusItem
              color="yellow"
              title="Waiting for Signal"
              description="No trade yet — conditions not met (normal)."
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="What happens next"
              text="The engine checks conditions on a schedule. When the market meets your bot’s rules and risk limits, it executes automatically."
            />
            <InfoCard
              title="What you should NOT do"
              text="Don’t keep toggling settings trying to force trades. Most losses come from forcing action. YieldCraft is designed to wait."
            />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Performance targets are design goals, not promises. Markets are risky and results vary.
          </p>
        </section>

        {/* CONNECTION NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm font-semibold text-sky-200">Connection check ≠ trade</p>
          <p className="mt-1 text-xs text-slate-300">
            When you connect your API key, YieldCraft performs a signed heartbeat check.
            This confirms access — it does <span className="font-semibold">not</span> place a trade.
          </p>
        </div>

        {/* STEPS */}
        <div id="steps" className="space-y-6">
          <StepCard
            id="step-plan"
            number={1}
            title="Pick a plan (Starter → Pro → Atlas)"
            bullets={[
              "Starter is perfect to begin",
              "Pro unlocks the full bot suite",
              "Atlas is a buy-only long-term allocation you can bundle anytime",
            ]}
            primary={{ label: "Go to Pricing", internalHref: "/pricing" }}
            comfort={{
              title: "Comfort check",
              lines: [
                "After checkout, return here and continue to Coinbase.",
                "If you’re brand-new, start small — consistency beats size.",
              ],
            }}
          />

          <StepCard
            id="step-coinbase"
            number={2}
            title="Coinbase: use your existing account or create a dedicated trading account (recommended)"
            bullets={[
              "If you already have Coinbase: use that account OR create a dedicated account/portfolio for bots (recommended).",
              "Dedicated account/portfolio keeps personal holdings separate and makes position tracking cleaner.",
              "API key must be View + Trade only (NO withdrawals).",
            ]}
            primary={{
              label: "I already have Coinbase (continue)",
              onClick: () => scrollToId("step-api-key"),
            }}
            secondary={{
              label: "Open Coinbase",
              href: coinbaseSignupUrl,
            }}
            tertiary={{
              label: "Then go to API settings →",
              href: COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title: "Rules-of-thumb",
              lines: [
                "Never enable withdrawals on API keys.",
                "If you already hold BTC in the same account, the system may detect an existing position when managing trades.",
                "If you choose a dedicated account/portfolio, keep it simple: fund it and let bots operate there.",
              ],
            }}
          />

          <StepCard
            id="step-api-key"
            number={3}
            title="Create a Coinbase API key (View + Trade only)"
            bullets={[
              "Open Coinbase API settings",
              "Create an API key with View + Trade only (NO withdrawals)",
              "Copy two values: API key name + private key",
              "If your Coinbase account/portfolio is new: deposit/fund it before trading can occur",
            ]}
            primary={{
              label: "Open Coinbase API settings",
              href: COINBASE_API_SETTINGS_URL,
            }}
            comfort={{
              title: "CRITICAL: don’t lose the private key",
              lines: [
                "Coinbase may show the private key ONE TIME. Don’t close that window yet.",
                "Keep Coinbase open until you paste both values into YieldCraft and click Verify & Continue.",
                "If you closed it, create a NEW API key and paste the new values.",
              ],
            }}
          />

          <StepCard
            id="step-connect"
            number={4}
            title="Connect your keys in YieldCraft (verify before leaving Coinbase)"
            bullets={[
              "Open Connect Keys",
              "Paste API key name + private key",
              "Click Verify & Continue",
              "Confirm: YOUR COINBASE turns GREEN (server-verified)",
            ]}
            primary={{ label: "Open Connect Keys", internalHref: "/connect-keys" }}
            comfort={{
              title: "Comfort check",
              lines: [
                "Do not close Coinbase until YOUR COINBASE is GREEN in YieldCraft.",
                "If connection fails, re-copy using Coinbase copy icons (don’t drag-select).",
                "Withdrawals are never required — trades happen inside your exchange account.",
              ],
            }}
          />

          <StepCard
            id="step-dashboard"
            number={5}
            title="Go to Dashboard and confirm green lights"
            bullets={[
              "Open Dashboard",
              "Confirm: Signed in + Plan active + YOUR COINBASE green",
              "No trade is normal — waiting is part of the system",
            ]}
            primary={{ label: "Go to Dashboard", internalHref: "/dashboard" }}
            comfort={{
              title: "Important",
              lines: [
                "Connection check ≠ trade.",
                "The system won’t force trades just to ‘feel active’.",
                "Green lights mean the system is ready — the engine waits for the right moment.",
              ],
            }}
          />
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
          <h3 className="text-xl font-semibold">Ready to activate?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Start simple. Click the steps in order. Confirm the lights. Then let YieldCraft do what it’s built to do:
            wait for high-quality conditions and execute with guardrails.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Choose a Plan
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Go to Dashboard
            </Link>

            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Learn Atlas (Long-Term)
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            Tip: If you set <span className="font-mono text-slate-300">NEXT_PUBLIC_COINBASE_REF_URL</span>, the “Open Coinbase” button will use it
            automatically (no “affiliate” wording shown).
          </p>
        </div>
      </div>
    </main>
  );
}

/* ---------- Components ---------- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function MiniStep({
  title,
  subtitle,
  active,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 transition " +
        (active
          ? "border-sky-500/40 bg-sky-500/5 shadow-[0_0_0_1px_rgba(56,189,248,0.10)]"
          : "border-slate-800 bg-slate-950/40")
      }
    >
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function InfoTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function StatusItem({
  color,
  title,
  description,
}: {
  color: "green" | "yellow" | "red";
  title: string;
  description: string;
}) {
  const colorMap: Record<"green" | "yellow" | "red", string> = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };

  const ringMap: Record<"green" | "yellow" | "red", string> = {
    green: "shadow-[0_0_0_4px_rgba(52,211,153,0.12)]",
    yellow: "shadow-[0_0_0_4px_rgba(251,191,36,0.12)]",
    red: "shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <span className={`mt-1 h-3 w-3 rounded-full ${colorMap[color]} ${ringMap[color]}`} />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function StepCard({
  id,
  number,
  title,
  bullets,
  primary,
  secondary,
  tertiary,
  comfort,
}: {
  id?: string;
  number: number;
  title: string;
  bullets: string[];
  primary: { label: string; href?: string; internalHref?: string; onClick?: () => void };
  secondary?: { label: string; href: string };
  tertiary?: { label: string; href: string };
  comfort: { title: string; lines: string[] };
}) {
  return (
    <div
      id={id}
      className="rounded-3xl border border-slate-800 bg-slate-900/40 p-7 hover:border-sky-500/25 hover:shadow-[0_0_70px_rgba(56,189,248,0.08)] transition"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400 text-sm font-extrabold text-slate-950">
            {number}
          </div>

          <div className="min-w-0">
            <h4 className="text-lg font-semibold">{title}</h4>

            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-300/80" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              {/* Primary */}
              {primary.onClick ? (
                <button
                  type="button"
                  onClick={primary.onClick}
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </button>
              ) : primary.internalHref ? (
                <Link
                  href={primary.internalHref}
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </Link>
              ) : (
                <a
                  href={primary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
                >
                  {primary.label}
                </a>
              )}

              {/* Secondary (external) */}
              {secondary ? (
                <a
                  href={secondary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                >
                  {secondary.label}
                </a>
              ) : null}

              {/* Tertiary (external) */}
              {tertiary ? (
                <a
                  href={tertiary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
                >
                  {tertiary.label}
                </a>
              ) : null}

              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/40 px-4 py-3 text-xs font-semibold text-slate-200">
                Follow the buttons in order. No guessing.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-sm font-semibold text-slate-100">{comfort.title}</p>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
          {comfort.lines.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
