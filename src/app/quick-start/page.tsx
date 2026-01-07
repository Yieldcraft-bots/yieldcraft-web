// src/app/quick-start/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

type StepKey = "coinbase" | "plan" | "keys" | "armed";
type StepStatus = "todo" | "doing" | "done";

const STORAGE_KEY = "yc_quickstart_v1";

export default function QuickStartPage() {
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    coinbase: false,
    plan: false,
    keys: false,
    armed: false,
  });

  const refs = {
    coinbase: useRef<HTMLDivElement | null>(null),
    plan: useRef<HTMLDivElement | null>(null),
    keys: useRef<HTMLDivElement | null>(null),
    armed: useRef<HTMLDivElement | null>(null),
  };

  // Load progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setDone((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist progress
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done]);

  const progress = useMemo(() => {
    const order: StepKey[] = ["coinbase", "plan", "keys", "armed"];
    const firstIncomplete = order.find((k) => !done[k]) ?? "armed";
    const status: Record<StepKey, StepStatus> = {
      coinbase: "todo",
      plan: "todo",
      keys: "todo",
      armed: "todo",
    };

    for (const k of order) {
      if (done[k]) status[k] = "done";
      else status[k] = k === firstIncomplete ? "doing" : "todo";
    }

    const completedCount = order.filter((k) => done[k]).length;
    const pct = Math.round((completedCount / order.length) * 100);

    return { order, firstIncomplete, status, completedCount, pct };
  }, [done]);

  function scrollToStep(key: StepKey) {
    const el = refs[key].current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markDone(key: StepKey) {
    setDone((prev) => ({ ...prev, [key]: true }));
    const order: StepKey[] = ["coinbase", "plan", "keys", "armed"];
    const idx = order.indexOf(key);
    const next = order[idx + 1];
    if (next) {
      setTimeout(() => scrollToStep(next), 250);
    }
  }

  function resetProgress() {
    setDone({ coinbase: false, plan: false, keys: false, armed: false });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setTimeout(() => scrollToStep("coinbase"), 150);
  }

  const allDone = progress.completedCount === 4;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* subtle glow background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[80px]" />
        <div className="absolute top-[20%] right-[-240px] h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-[90px]" />
        <div className="absolute bottom-[-260px] left-[-260px] h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-[90px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        {/* HERO */}
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-300 uppercase">
            Quick Start Guide
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Get{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
              connected
            </span>
            , get{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
              confirmed
            </span>
            , then let the engine{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
              wait for the right moment
            </span>
            .
          </h1>

          <p className="mt-5 text-lg text-slate-300">
            YieldCraft connects directly to your exchange using signed requests.
            <br />
            No third-party bridges. No “fund transfers.” No confusion.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">Important:</span> it’s
              normal to see <span className="font-semibold text-sky-200">no trade</span>{" "}
              right away. <span className="font-semibold">Waiting is part of the strategy.</span>
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Your “proof” is the green lights + heartbeat confirmation — not an immediate order.
            </p>
          </div>
        </div>

        {/* PROGRESS RAIL */}
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">5-minute setup</h2>
              <p className="mt-1 text-sm text-slate-400">
                Click the buttons in order. Each step gives you a ✅ confirmation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge>Direct execution</Badge>
              <Badge>Risk guardrails</Badge>
              <Badge>No withdrawals</Badge>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Progress: <span className="text-slate-200 font-semibold">{progress.pct}%</span>
              </span>
              <button
                type="button"
                onClick={resetProgress}
                className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-sky-500/40 hover:text-sky-200 transition"
              >
                Reset
              </button>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-950/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <RailItem
                label="1) Coinbase ready"
                status={progress.status.coinbase}
                onClick={() => scrollToStep("coinbase")}
              />
              <RailItem
                label="2) Plan selected"
                status={progress.status.plan}
                onClick={() => scrollToStep("plan")}
              />
              <RailItem
                label="3) Keys connected"
                status={progress.status.keys}
                onClick={() => scrollToStep("keys")}
              />
              <RailItem
                label="4) Engine armed"
                status={progress.status.armed}
                onClick={() => scrollToStep("armed")}
              />
            </div>
          </div>
        </div>

        {/* DISCIPLINE SYSTEM (COMFORT + SIZING ANSWER) */}
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.26em] text-sky-300 uppercase">
                The Discipline System
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                Build a system for yourself — then let the bots go to work.
              </h3>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl">
                YieldCraft is designed to reward consistency, not impulse. Most people fail because
                they trade emotionally. We help you build a repeatable habit:{" "}
                <span className="font-semibold text-slate-50">pay yourself first</span>, contribute
                consistently, and let disciplined automation do what it’s built to do.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Chip>Consistency &gt; intensity</Chip>
                <Chip>Risk guardrails</Chip>
                <Chip>Never force trades</Chip>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MiniCard
              title="Start small (yes, even $60)"
              text="YieldCraft supports small accounts. Smaller balances may trade less often — by design. Your job is to build the habit."
            />
            <MiniCard
              title="Add a consistent amount"
              text="Many users pick a monthly contribution (like paying themselves first). This builds discipline and reduces emotional decision-making."
            />
            <MiniCard
              title="Let the engine wait"
              text="YieldCraft does not trade constantly. No trade is often a sign of discipline — not a problem."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-200">
              <span className="font-semibold text-slate-50">Sizing (important):</span>{" "}
              YieldCraft reads your available balances from the exchange and constrains order sizes by
              available funds, exchange minimums, and risk controls.
              <span className="font-semibold text-sky-200"> No leverage. No forced sizing.</span>
            </p>
          </div>
        </div>

        {/* STATUS LIGHTS */}
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Live status lights</h2>
              <p className="mt-1 text-sm text-slate-400">
                This is what “live” looks like even when there’s no signal yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>Direct execution</Badge>
              <Badge>Risk guardrails</Badge>
              <Badge>Maker-first behavior</Badge>
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
              color="sky"
              title="Waiting (success)"
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
        </div>

        {/* CONNECTION ≠ TRADE NOTICE */}
        <div className="mb-10 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
          <p className="text-sm font-semibold text-sky-200">Connection check ≠ trade</p>
          <p className="mt-1 text-xs text-slate-200">
            When you connect your API key, YieldCraft performs a signed heartbeat check. This confirms
            access — it does <span className="font-semibold">not</span> place a trade.
          </p>
        </div>

        {/* BIG BUTTON STRIP (5-YEAR-OLD MODE) */}
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <h3 className="text-xl font-semibold">Do it in order (tap → done ✅)</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            If you only do one thing: click Step 1 → Step 2 → Step 3 → Step 4. Each step gives you a
            confirmation so you know you did it right.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <BigAction
              number={1}
              title="Open Coinbase API"
              subtitle="Create key (View + Trade only)"
              href="https://www.coinbase.com/settings/api"
              done={done.coinbase}
              onDone={() => markDone("coinbase")}
            />
            <BigAction
              number={2}
              title="Pick a plan"
              subtitle="Starter → Pro → Atlas"
              internalHref="/pricing"
              done={done.plan}
              onDone={() => markDone("plan")}
            />
            <BigAction
              number={3}
              title="Connect keys"
              subtitle="Paste in YieldCraft"
              internalHref="/connect-keys"
              done={done.keys}
              onDone={() => markDone("keys")}
            />
            <BigAction
              number={4}
              title="Go to dashboard"
              subtitle="Turn engine on"
              internalHref="/dashboard"
              done={done.armed}
              onDone={() => markDone("armed")}
            />
          </div>
        </div>

        {/* STEPS (DETAILED) */}
        <div className="space-y-6">
          <div ref={(n) => (refs.coinbase.current = n)}>
            <StepCard
              number={1}
              title="Create / enable your Coinbase Advanced Trade account (and fund it if it’s new)"
              text={
                "Enable Advanced Trade, then create an API key with View + Trade permissions only (no withdrawals).\n" +
                "If your Coinbase account is new, you must deposit/fund it before any trading can occur.\n\n" +
                "You’ll copy two values:\n" +
                "• API key name\n" +
                "• Private key\n"
              }
              href="https://www.coinbase.com/settings/api"
              cta="Open Coinbase API settings"
              isDone={done.coinbase}
              onDone={() => markDone("coinbase")}
            />
          </div>

          <div ref={(n) => (refs.plan.current = n)}>
            <StepCard
              number={2}
              title="Pick a plan (Starter → Pro → Atlas)"
              text={
                "Starter is perfect to begin. Pro unlocks the full bot suite.\n" +
                "Atlas is a buy-only long-term allocator you can bundle anytime."
              }
              internalHref="/pricing"
              cta="Go to Pricing"
              isDone={done.plan}
              onDone={() => markDone("plan")}
            />
          </div>

          <div ref={(n) => (refs.keys.current = n)}>
            <StepCard
              number={3}
              title="Connect your exchange keys in YieldCraft"
              text={
                "Paste your API key name + private key into the secure onboarding flow.\n\n" +
                "Checklist before you paste:\n" +
                "• Permissions: View + Trade\n" +
                "• Withdrawals: OFF\n" +
                "• IP restrictions: none required\n\n" +
                "YieldCraft uses signed requests and never holds your funds."
              }
              internalHref="/connect-keys"
              cta="Open Secure Onboarding"
              isDone={done.keys}
              onDone={() => markDone("keys")}
            />
          </div>

          <div ref={(n) => (refs.armed.current = n)}>
            <StepCard
              number={4}
              title="Turn the engine on (then watch the green lights)"
              text={
                "Once enabled, the bot may wait. That’s normal.\n" +
                "Your confirmation is:\n" +
                "• Connected\n" +
                "• Engine Armed\n" +
                "• Heartbeat OK\n\n" +
                "Waiting means the system is being selective — that is a feature."
              }
              internalHref="/dashboard"
              cta="Go to Dashboard"
              isDone={done.armed}
              onDone={() => markDone("armed")}
            />
          </div>
        </div>

        {/* YOU'RE LIVE MOMENT */}
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold">
                {allDone ? "🎉 You’re live. The system is working." : "When you finish Step 4…"}
              </h3>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl">
                {allDone
                  ? "You’ve done everything correctly. From here, the engine may wait for high-quality conditions — and that’s success."
                  : "You’ll see this message: a clean “you’re connected” moment with exactly what’s true — so you never wonder if it worked."}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SuccessLine ok={allDone || done.keys} text="Exchange connected (signed requests verified)" />
                <SuccessLine ok={allDone || done.armed} text="Engine armed (bots enabled + guardrails active)" />
                <SuccessLine ok={allDone} text="Waiting for signal (this is normal — selective entries)" />
                <SuccessLine ok={true} text="No withdrawals (YieldCraft never moves funds)" />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-slate-50">You do not need to do anything else.</span>{" "}
                  Don’t keep toggling settings to “force” action. YieldCraft is designed to wait, then execute with guardrails.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:opacity-95"
                >
                  Go to Dashboard
                </Link>

                <Link
                  href="/connect-keys"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/40 hover:text-sky-200 transition"
                >
                  Re-check Keys
                </Link>

                <Link
                  href="/atlas"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/40 hover:text-sky-200 transition"
                >
                  Learn Atlas (Long-Term)
                </Link>
              </div>
            </div>

            <div className="md:w-[320px]">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
                <p className="text-sm font-semibold text-slate-50">New to Coinbase?</p>
                <p className="mt-2 text-xs text-slate-400">
                  If your account is brand new, you’ll need to deposit funds before any trading can occur.
                </p>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <p className="text-xs font-semibold text-sky-200">A simple discipline rule</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Start with what you can — even <span className="font-semibold">$60</span>. Then add a consistent monthly
                    amount (pay yourself first). The habit is the edge.
                  </p>
                </div>

                <a
                  href="https://www.coinbase.com/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/50 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-sky-500/40 hover:text-sky-200 transition"
                >
                  Open Coinbase API Settings
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTNOTE */}
        <p className="mt-8 text-xs text-slate-600">
          Trading involves risk. YieldCraft provides automation and guardrails, not guarantees.
        </p>
      </div>
    </main>
  );
}

/* ---------- UI bits ---------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function RailItem({
  label,
  status,
  onClick,
}: {
  label: string;
  status: StepStatus;
  onClick: () => void;
}) {
  const dot =
    status === "done"
      ? "bg-emerald-400"
      : status === "doing"
      ? "bg-sky-300"
      : "bg-slate-600";

  const border =
    status === "done"
      ? "border-emerald-500/30"
      : status === "doing"
      ? "border-sky-500/30"
      : "border-slate-800";

  const text =
    status === "done"
      ? "text-emerald-200"
      : status === "doing"
      ? "text-sky-200"
      : "text-slate-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl border ${border} bg-slate-950/40 px-4 py-3 text-left transition hover:border-sky-500/40`}
      aria-label={label}
    >
      <span className={`h-3 w-3 rounded-full ${dot} shadow-[0_0_0_4px_rgba(56,189,248,0.10)]`} />
      <span className={`text-sm font-semibold ${text} group-hover:text-sky-200 transition`}>
        {label}
      </span>
    </button>
  );
}

function MiniCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-slate-50">{title}</p>
      <p className="mt-2 text-xs text-slate-400">{text}</p>
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
  color: "green" | "sky" | "red";
  title: string;
  description: string;
}) {
  const colorMap = {
    green: "bg-emerald-400",
    sky: "bg-sky-300",
    red: "bg-red-500",
  };

  const ringMap = {
    green: "shadow-[0_0_0_4px_rgba(52,211,153,0.12)]",
    sky: "shadow-[0_0_0_4px_rgba(56,189,248,0.12)]",
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
  number,
  title,
  text,
  href,
  internalHref,
  cta,
  isDone,
  onDone,
}: {
  number: number;
  title: string;
  text: string;
  href?: string;
  internalHref?: string;
  cta?: string;
  isDone: boolean;
  onDone: () => void;
}) {
  const className =
    "relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/35 p-6 " +
    "transition hover:border-sky-500/35 hover:shadow-[0_0_70px_rgba(56,189,248,0.10)]";

  return (
    <div className={className}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 text-sm font-extrabold text-slate-950 shadow-lg">
            {number}
          </div>

          <div className="min-w-0">
            <h4 className="text-base font-semibold">{title}</h4>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{text}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              {internalHref ? (
                <Link
                  href={internalHref}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:opacity-95"
                >
                  {cta ?? "Open"}
                </Link>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:opacity-95"
                >
                  {cta ?? "Open"}
                </a>
              ) : null}

              <button
                type="button"
                onClick={onDone}
                className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-950/40 text-slate-100 hover:border-sky-500/40 hover:text-sky-200"
                }`}
                aria-label={isDone ? "Completed" : "Mark as done"}
              >
                {isDone ? "✅ Done" : "✅ I did this"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-300">
                {isDone ? (
                  <>
                    <span className="font-semibold text-emerald-200">Confirmed:</span>{" "}
                    you completed this step. Keep going — you’re almost live.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-sky-200">Tip:</span> Click the main button,
                    finish the action, then hit <span className="font-semibold">“I did this”</span>{" "}
                    to get your confirmation ✅
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* right-side comfort badge */}
        <div className="md:w-[260px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm font-semibold text-slate-50">Comfort check</p>
            <p className="mt-2 text-xs text-slate-400">
              If you completed the action and clicked “I did this,” you did it right.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <CheckRow ok={true} text="No withdrawals required" />
              <CheckRow ok={true} text="YieldCraft never holds funds" />
              <CheckRow ok={isDone} text="This step confirmed" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BigAction({
  number,
  title,
  subtitle,
  href,
  internalHref,
  done,
  onDone,
}: {
  number: number;
  title: string;
  subtitle: string;
  href?: string;
  internalHref?: string;
  done: boolean;
  onDone: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 text-sm font-extrabold text-slate-950">
          {number}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-50">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {internalHref ? (
          <Link
            href={internalHref}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:opacity-95"
          >
            Open
          </Link>
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:opacity-95"
          >
            Open
          </a>
        ) : null}

        <button
          type="button"
          onClick={onDone}
          className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
            done
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700 bg-slate-950/40 text-slate-100 hover:border-sky-500/40 hover:text-sky-200"
          }`}
        >
          {done ? "✅ Done" : "✅ I did this"}
        </button>
      </div>
    </div>
  );
}

function SuccessLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <span
        className={`mt-0.5 h-4 w-4 rounded-full ${
          ok ? "bg-emerald-400" : "bg-slate-600"
        } shadow-[0_0_0_4px_rgba(52,211,153,0.10)]`}
      />
      <p className={`text-sm ${ok ? "text-slate-100" : "text-slate-400"}`}>{text}</p>
    </div>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-600"}`} />
      <span className={`text-xs ${ok ? "text-slate-200" : "text-slate-500"}`}>{text}</span>
    </div>
  );
}
