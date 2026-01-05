// src/app/quick-start/page.tsx
import Link from "next/link";

export default function QuickStartPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {/* HERO */}
        <div className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Quick Start Guide
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Get{" "}
            <span className="text-amber-400">connected</span>, get{" "}
            <span className="text-amber-400">confirmed</span>, then let the engine{" "}
            <span className="text-amber-400">wait for the right moment</span>.
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            YieldCraft connects directly to your exchange using signed requests.
            <br />
            No third-party bridges. No “fund transfers.” No confusion.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-slate-50">Important:</span> it’s normal
              to see <span className="text-amber-300 font-semibold">no trade</span> right away.
              Waiting is part of the strategy.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Your “proof” is the green lights + heartbeat confirmation — not an immediate order.
            </p>
          </div>
        </div>

        {/* STATUS PANEL */}
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
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
            Performance targets are design goals, not promises. YieldCraft is live today with disciplined execution
            and risk guardrails, while intelligence layers evolve continuously as the system learns.
            Markets are risky and results vary.
          </p>
        </div>

        {/* CONNECTION ≠ TRADE NOTICE */}
        <div className="mb-14 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Connection check ≠ trade
          </p>
          <p className="mt-1 text-xs text-slate-300">
            When you connect your API key, YieldCraft performs a signed heartbeat check.
            This confirms access — it does <span className="font-semibold">not</span> place a trade.
          </p>
        </div>

        {/* STEPS */}
        <div className="space-y-6">
          <Step
            number={1}
            title="Create / enable your Coinbase Advanced Trade account"
            text="Enable Advanced Trade, then create an API key with View + Trade permissions only (no withdrawals). You’ll copy two values: the key name and the private key. We’ll show you exactly where to paste them next."
            href="https://www.coinbase.com/settings/api"
            cta="Open Coinbase API settings"
          />

          <Step
            number={2}
            title="Pick a plan (Starter → Pro → Atlas)"
            text="Starter is perfect to begin. Pro unlocks the full bot suite. Atlas is a buy-only long-term allocator you can bundle anytime."
            internalHref="/pricing"
            cta="Go to Pricing"
          />

          <Step
            number={3}
            title="Connect your exchange keys in YieldCraft"
            text={
              "Paste your API key name + private key into the secure onboarding flow.\n" +
              "Checklist before you paste:\n" +
              "• Permissions: View + Trade\n" +
              "• Withdrawals: OFF\n" +
              "• IP restrictions: none required\n" +
              "YieldCraft uses signed requests and never holds your funds."
            }
            internalHref="/connect-keys"
            cta="Open Secure Onboarding"
          />

          <Step
            number={4}
            title="Turn the engine on (then watch the green lights)"
            text="Once enabled, the bot may wait. That’s normal. Your confirmation is: Connected + Engine Armed + Heartbeat OK."
            internalHref="/dashboard"
            cta="Go to Dashboard"
          />
        </div>

        {/* CTA STRIP */}
        <div className="mt-14 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-xl font-semibold">Ready to activate?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Start simple. Get connected. Confirm the lights. Then let YieldCraft do what it’s built to do:
            wait for high-quality conditions and execute with guardrails.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
            >
              Choose a Plan
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Go to Dashboard
            </Link>

            <Link
              href="/atlas"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              Learn Atlas (Long-Term)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
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
  const colorMap = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };

  const ringMap = {
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

function Step({
  number,
  title,
  text,
  href,
  internalHref,
  cta,
}: {
  number: number;
  title: string;
  text: string;
  href?: string;
  internalHref?: string;
  cta?: string;
}) {
  const clickable = Boolean(href || internalHref);

  const CardInner = (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-950">
        {number}
      </div>
      <div className="min-w-0 whitespace-pre-line">
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-sm text-slate-400">{text}</p>
        {clickable && (
          <p className="mt-2 text-xs font-semibold text-amber-300">
            → {cta ?? "Open"}
          </p>
        )}
      </div>
    </div>
  );

  const className =
    "group relative block rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition " +
    "hover:border-amber-500/40 hover:shadow-[0_0_60px_rgba(251,191,36,0.10)]";

  if (internalHref) {
    return (
      <Link href={internalHref} className={className}>
        {CardInner}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {CardInner}
      </a>
    );
  }

  return <div className={className}>{CardInner}</div>;
}
