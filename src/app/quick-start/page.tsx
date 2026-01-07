"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";

/**
 * Quick Start — 5 minute guided flow
 * - No external libs
 * - No TS ref callback return issues
 * - Soft-glass premium UI
 * - Progress / comfort checks (client-side)
 */

type StepKey = "coinbase" | "plan" | "connect" | "arm";

export default function QuickStartPage() {
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    coinbase: false,
    plan: false,
    connect: false,
    arm: false,
  });

  const refs = {
    coinbase: useRef<HTMLDivElement | null>(null),
    plan: useRef<HTMLDivElement | null>(null),
    connect: useRef<HTMLDivElement | null>(null),
    arm: useRef<HTMLDivElement | null>(null),
  };

  const doneCount = useMemo(
    () => Object.values(done).filter(Boolean).length,
    [done]
  );

  const nextKey = useMemo<StepKey | null>(() => {
    if (!done.coinbase) return "coinbase";
    if (!done.plan) return "plan";
    if (!done.connect) return "connect";
    if (!done.arm) return "arm";
    return null;
  }, [done]);

  function scrollTo(key: StepKey) {
    const el = refs[key].current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markDone(key: StepKey) {
    setDone((p) => ({ ...p, [key]: true }));
  }

  function toggleDone(key: StepKey) {
    setDone((p) => ({ ...p, [key]: !p[key] }));
  }

  const progressLabel =
    doneCount === 0
      ? "Start here"
      : doneCount === 4
      ? "All set"
      : `${doneCount}/4 complete`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.18),transparent_55%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-20">
        {/* HERO */}
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Quick Start Guide
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Get{" "}
            <span className="text-sky-300">connected</span>, get{" "}
            <span className="text-sky-300">confirmed</span>, then let the engine{" "}
            <span className="text-sky-300">wait for the right moment</span>.
          </h1>

          <p className="mt-5 text-lg text-slate-300">
            YieldCraft connects directly to your exchange using signed requests.
            <br />
            No third-party bridges. No “fund transfers.” No confusion.
          </p>

          {/* 5-minute rail */}
          <div className="mt-7 rounded-3xl border border-slate-800 bg-slate-900/35 p-5 shadow-[0_0_80px_rgba(56,189,248,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  5-minute setup (click in order)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Your goal is simple:{" "}
                  <span className="text-slate-200 font-semibold">
                    connect → confirm → arm → wait
                  </span>
                  .
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-200">
                  {progressLabel}
                </span>
                <span className="text-xs text-slate-500">
                  {doneCount === 4 ? "✅" : "→"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <BigAction
                title="1) Coinbase"
                subtitle="Open API settings"
                active={nextKey === "coinbase"}
                done={done.coinbase}
                onClick={() => scrollTo("coinbase")}
              />
              <BigAction
                title="2) Plan"
                subtitle="Choose your tier"
                active={nextKey === "plan"}
                done={done.plan}
                onClick={() => scrollTo("plan")}
              />
              <BigAction
                title="3) Connect"
                subtitle="Paste keys securely"
                active={nextKey === "connect"}
                done={done.connect}
                onClick={() => scrollTo("connect")}
              />
              <BigAction
                title="4) Arm"
                subtitle="Watch green lights"
                active={nextKey === "arm"}
                done={done.arm}
                onClick={() => scrollTo("arm")}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold">Important:</span> it’s normal to
                see <span className="text-sky-300 font-semibold">no trade</span>{" "}
                right away. Waiting is part of the strategy.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Your “proof” is the green lights + heartbeat confirmation — not
                an immediate order.
              </p>
            </div>
          </div>
        </div>

        {/* DISCIPLINE SYSTEM */}
        <div className="mb-10 rounded-[28px] border border-slate-800 bg-slate-900/35 p-6 shadow-[0_0_100px_rgba(2,132,199,0.10)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.28em] text-sky-400 uppercase">
                The Discipline System
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold">
                Build a system for yourself — then let the bots go to work.
              </h2>
              <p className="mt-3 text-sm md:text-base text-slate-300">
                YieldCraft is designed to reward consistency, not impulse. We
                help you build a repeatable habit:{" "}
                <span className="text-slate-100 font-semibold">
                  pay yourself first, contribute consistently
                </span>
                , and let disciplined automation do what it’s built to do.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill>Consistency &gt; intensity</Pill>
              <Pill>Risk guardrails</Pill>
              <Pill>Never force trades</Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MiniCard
              title="Start small (yes, even $60)"
              text="YieldCraft supports small accounts. Smaller balances may trade less often — by design."
            />
            <MiniCard
              title="Add a consistent amount"
              text="Many users choose a monthly contribution (like paying yourself first). This builds discipline and reduces emotional decision-making."
            />
            <MiniCard
              title="Let the engine wait"
              text="YieldCraft does not trade constantly. No trade is often a sign of discipline — not a problem."
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold">How sizing works:</span> YieldCraft
              reads your available balances from the exchange and constrains
              order sizes by available funds, minimum order rules, and risk
              controls. <span className="font-semibold">No leverage.</span>{" "}
              <span className="font-semibold">No forced sizing.</span>
            </p>
          </div>
        </div>

        {/* STATUS PANEL */}
        <div className="mb-10 rounded-[28px] border border-slate-800 bg-slate-900/35 p-6 shadow-[0_0_100px_rgba(56,189,248,0.08)] backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Live status lights</h2>
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
            Performance targets are design goals, not promises. Markets are risky
            and results vary.
          </p>
        </div>

        {/* CONNECTION ≠ TRADE NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm font-semibold text-sky-200">
            Connection check ≠ trade
          </p>
          <p className="mt-1 text-xs text-slate-300">
            When you connect your API key, YieldCraft performs a signed heartbeat
            check. This confirms access — it does{" "}
            <span className="font-semibold">not</span> place a trade.
          </p>
        </div>

        {/* STEPS (DETAILED) */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div
            ref={(n) => {
              refs.coinbase.current = n;
            }}
          >
            <StepCard
              number={1}
              title="Create / enable your Coinbase Advanced Trade account (and fund it if it’s new)"
              bullets={[
                "Open Coinbase API settings",
                "Create an API key with View + Trade only (NO withdrawals)",
                "If your Coinbase account is new: deposit/fund it before trading can occur",
                "Copy two values: API key name + private key",
              ]}
              actions={[
                {
                  kind: "external",
                  href: "https://www.coinbase.com/settings/api",
                  label: "Open Coinbase API settings",
                },
                {
                  kind: "toggle",
                  label: done.coinbase ? "✅ Done" : "✅ I did this",
                  onClick: () => markDone("coinbase"),
                },
              ]}
              done={done.coinbase}
              onToggle={() => toggleDone("coinbase")}
              comfort={{
                title: "How do I know this step is correct?",
                lines: [
                  "Your API key permissions should show View + Trade.",
                  "Withdrawals must be OFF.",
                  "If you have $0 available balance, no trades can execute — fund first.",
                ],
              }}
            />
          </div>

          {/* Step 2 */}
          <div
            ref={(n) => {
              refs.plan.current = n;
            }}
          >
            <StepCard
              number={2}
              title="Pick a plan (Starter → Pro → Atlas)"
              bullets={[
                "Starter is perfect to begin",
                "Pro unlocks the full bot suite",
                "Atlas is buy-only long-term allocation you can bundle anytime",
              ]}
              actions={[
                { kind: "internal", href: "/pricing", label: "Go to Pricing" },
                {
                  kind: "toggle",
                  label: done.plan ? "✅ Done" : "✅ I picked a plan",
                  onClick: () => markDone("plan"),
                },
              ]}
              done={done.plan}
              onToggle={() => toggleDone("plan")}
              comfort={{
                title: "Comfort check",
                lines: [
                  "After checkout, return here and continue to Connect.",
                  "If you’re brand-new, start small — consistency beats size.",
                ],
              }}
            />
          </div>

          {/* Step 3 */}
          <div
            ref={(n) => {
              refs.connect.current = n;
            }}
          >
            <StepCard
              number={3}
              title="Connect your exchange keys in YieldCraft"
              bullets={[
                "Open Secure Onboarding",
                "Paste API key name + private key",
                "Checklist: View + Trade ✅, Withdrawals OFF ✅",
                "YieldCraft never holds your funds (direct signed requests)",
              ]}
              actions={[
                { kind: "internal", href: "/connect-keys", label: "Open Secure Onboarding" },
                {
                  kind: "toggle",
                  label: done.connect ? "✅ Done" : "✅ Keys connected",
                  onClick: () => markDone("connect"),
                },
              ]}
              done={done.connect}
              onToggle={() => toggleDone("connect")}
              comfort={{
                title: "How do I know I’m connected?",
                lines: [
                  "You should be able to see confirmation / success messaging in the app.",
                  "If connection fails, re-check you copied the key name + private key exactly.",
                  "No withdrawals are ever required — trades happen inside your exchange account.",
                ],
              }}
            />
          </div>

          {/* Step 4 */}
          <div
            ref={(n) => {
              refs.arm.current = n;
            }}
          >
            <StepCard
              number={4}
              title="Turn the engine on (then watch the green lights)"
              bullets={[
                "Go to Dashboard",
                "Enable the engine / bots (if your plan allows it)",
                "Your confirmation is: Connected + Engine Armed + Heartbeat OK",
                "Then: let it wait — no trade is often normal",
              ]}
              actions={[
                { kind: "internal", href: "/dashboard", label: "Go to Dashboard" },
                {
                  kind: "toggle",
                  label: done.arm ? "✅ Done" : "✅ Engine armed",
                  onClick: () => markDone("arm"),
                },
              ]}
              done={done.arm}
              onToggle={() => toggleDone("arm")}
              comfort={{
                title: "Comfort check",
                lines: [
                  "If you see waiting/no signal: that’s normal — the system won’t force trades.",
                  "If your balance is too small for Coinbase minimums, trades may be less frequent.",
                ],
              }}
            />
          </div>
        </div>

        {/* CTA STRIP */}
        <div className="mt-12 rounded-[28px] border border-slate-800 bg-slate-900/35 p-6 shadow-[0_0_100px_rgba(56,189,248,0.08)] backdrop-blur">
          <h3 className="text-xl font-semibold">Ready to activate?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Start simple. Click the steps in order. Confirm the lights. Then let
            YieldCraft do what it’s built to do: wait for high-quality
            conditions and execute with guardrails.
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
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50 hover:shadow-[0_0_50px_rgba(56,189,248,0.14)]"
            >
              Go to Dashboard
            </Link>

            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50 hover:shadow-[0_0_50px_rgba(56,189,248,0.14)]"
            >
              Learn Atlas (Long-Term)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- UI Bits ---------- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/45 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
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
  const colorMap = {
    green: "bg-emerald-400",
    yellow: "bg-amber-300",
    red: "bg-red-500",
  };

  const ringMap = {
    green: "shadow-[0_0_0_4px_rgba(52,211,153,0.12)]",
    yellow: "shadow-[0_0_0_4px_rgba(251,191,36,0.10)]",
    red: "shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
      <span
        className={`mt-1 h-3 w-3 rounded-full ${colorMap[color]} ${ringMap[color]}`}
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function MiniCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

function BigAction({
  title,
  subtitle,
  active,
  done,
  onClick,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
  done?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "group rounded-2xl border px-4 py-3 text-left transition backdrop-blur " +
        (active
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_60px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-950/30 hover:border-sky-500/40 hover:bg-slate-950/45")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-50">{title}</p>
        <span
          className={
            "text-xs font-semibold " +
            (done ? "text-emerald-300" : "text-slate-500")
          }
        >
          {done ? "✓" : "•"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400 group-hover:text-slate-300">
        {subtitle}
      </p>
    </button>
  );
}

function StepCard({
  number,
  title,
  bullets,
  actions,
  done,
  onToggle,
  comfort,
}: {
  number: number;
  title: string;
  bullets: string[];
  actions: Array<
    | { kind: "external"; href: string; label: string }
    | { kind: "internal"; href: string; label: string }
    | { kind: "toggle"; label: string; onClick: () => void }
  >;
  done: boolean;
  onToggle: () => void;
  comfort: { title: string; lines: string[] };
}) {
  return (
    <div
      className={
        "rounded-[28px] border bg-slate-900/35 p-6 shadow-[0_0_90px_rgba(56,189,248,0.06)] backdrop-blur transition " +
        (done
          ? "border-emerald-500/30"
          : "border-slate-800 hover:border-sky-500/35")
      }
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-400 text-sm font-extrabold text-slate-950">
            {number}
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-semibold">{title}</h4>
            <ul className="mt-3 space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-sky-300/90" />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <button
            onClick={onToggle}
            className="inline-flex items-center justify-center rounded-full border border-slate-800 bg-slate-950/35 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
          >
            {done ? "Mark as not done" : "Mark as done later"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((a) => {
          if (a.kind === "external") {
            return (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
              >
                {a.label}
              </a>
            );
          }
          if (a.kind === "internal") {
            return (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
              >
                {a.label}
              </Link>
            );
          }
          // toggle
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className={
                "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition " +
                (done
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                  : "border-slate-700 bg-slate-950/35 text-slate-100 hover:border-sky-500/45 hover:shadow-[0_0_50px_rgba(56,189,248,0.12)]")
              }
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-sm font-semibold text-slate-50">{comfort.title}</p>
        <ul className="mt-2 space-y-1">
          {comfort.lines.map((t) => (
            <li key={t} className="text-xs text-slate-400">
              • {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
