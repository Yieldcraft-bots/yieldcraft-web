// src/app/system/page.tsx
import Link from "next/link";

export const metadata = {
  title: "The YieldCraft System",
  description:
    "A layered trading system built for control: intelligence, strategy, execution, and risk.",
};

function Pill({
  label,
  tone = "emerald",
}: {
  label: string;
  tone?: "emerald" | "sky" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25",
    sky: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25",
    amber: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25",
    rose: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/25",
    slate: "bg-slate-500/15 text-slate-200 ring-1 ring-slate-500/25",
  };

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
      ].join(" ")}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

function Card({
  title,
  subtitle,
  bullets,
  tag,
  tagTone = "sky",
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  tag: string;
  tagTone?: "emerald" | "sky" | "amber" | "rose" | "slate";
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xl font-bold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
        </div>
        <Pill label={tag} tone={tagTone} />
      </div>

      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400/80" />
            <span className="text-slate-200">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SystemPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* HERO */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-center gap-3">
            <Pill label="System Overview" tone="sky" />
            <Pill label="Separation of Concerns" tone="emerald" />
            <Pill label="Risk-First Design" tone="amber" />
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            The YieldCraft System —{" "}
            <span className="text-sky-300">control you can audit.</span>
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            YieldCraft is built as a layered decision system: intelligence informs strategy,
            strategy guides execution, and risk gates everything. The goal isn’t constant action —
            it’s consistent discipline.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/quick-start"
              className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950"
            >
              Quick Start →
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-slate-700 bg-slate-900/30 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
            >
              Plans →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 bg-slate-900/30 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Why this exists
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Markets don’t fail people. Uncontrolled systems do.
            </h2>
            <p className="mt-4 text-sm text-slate-300 sm:text-base">
              YieldCraft was created to turn a chaotic, emotional process into a structured one.
              The system is designed to be calm under stress: explicit rules, clear constraints,
              and failure states that you can understand.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">Rule-driven by design</p>
                <p className="mt-1 text-sm text-slate-400">
                  If a rule isn’t explicit, it doesn’t exist.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">Separation of roles</p>
                <p className="mt-1 text-sm text-slate-400">
                  Intelligence ≠ execution. Signals inform; gates decide.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">Auditability</p>
                <p className="mt-1 text-sm text-slate-400">
                  Each layer has defined inputs, outputs, and constraints.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">Risk-first posture</p>
                <p className="mt-1 text-sm text-slate-400">
                  “Not trading” is sometimes the correct decision.
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              System layers
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">1) Intelligence</p>
                <p className="mt-1 text-sm text-slate-400">
                  Recon, Horizon — measure regime, trend, momentum, risk context.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">2) Strategy</p>
                <p className="mt-1 text-sm text-slate-400">
                  Atlas — slower, thesis-driven allocations and longer horizon logic.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">3) Execution</p>
                <p className="mt-1 text-sm text-slate-400">
                  Pulse — deterministic execution with strict gates and sizing rules.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">4) Risk & Controls</p>
                <p className="mt-1 text-sm text-slate-400">
                  Safety gates, kill-switches, exposure controls, and audit logs.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ENGINES */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Engines
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Each engine has one job — and clear limits.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
              YieldCraft is not “one bot.” It’s a coordinated system where components are
              intentionally separated so mistakes can’t cascade.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card
            title="Pulse"
            subtitle="Execution Engine — precision over prediction."
            tag="Execution"
            tagTone="amber"
            bullets={[
              "Does not predict markets; it executes under rules.",
              "Enforces position sizing, cooldowns, and safe-mode gates.",
              "Designed to be boring — on purpose — and consistent under stress.",
            ]}
          />

          <Card
            title="Recon"
            subtitle="Market Intelligence — context, not commands."
            tag="Intelligence"
            tagTone="sky"
            bullets={[
              "Tracks regime shifts, trend strength, and momentum decay.",
              "Outputs confidence and context — never places orders directly.",
              "Keeps signal generation separate from execution by design.",
            ]}
          />

          <Card
            title="Atlas"
            subtitle="Long-Horizon Strategy — time as an edge."
            tag="Strategy"
            tagTone="emerald"
            bullets={[
              "Operates independently on a longer horizon than Pulse.",
              "Lower frequency, thesis-driven logic, portfolio mindset.",
              "Built for discipline — not constant interaction.",
            ]}
          />
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Advanced engines</p>
            <Pill label="Rolling out deliberately" tone="slate" />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Additional engines (Horizon, Ignition, Ascend, Forge, Edge) ship with the same philosophy:
            clear constraints, measurable behavior, and risk-first controls. No hype, no pressure —
            only what’s stable and testable.
          </p>
        </div>
      </section>

      {/* RISK */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            Risk is the product
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Risk management is not a feature. It is the product.
          </h2>

          <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
            YieldCraft is designed to prioritize survivability: safety gates, explicit constraints,
            and transparent status checks. The system is built to fail safely — and to tell you why.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Safety gates</p>
              <p className="mt-1 text-sm text-slate-400">
                Trading can be disabled globally, per-engine, or by safety conditions.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Kill-switch mindset</p>
              <p className="mt-1 text-sm text-slate-400">
                The system is designed to stop cleanly — and resume predictably.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Auditability</p>
              <p className="mt-1 text-sm text-slate-400">
                Status pills, logs, and deterministic behavior help explain what happened.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Controlled evolution</p>
              <p className="mt-1 text-sm text-slate-400">
                New capabilities roll out behind flags to protect stability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLOSURES */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            Disclosures
          </p>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            YieldCraft provides software tools for structured workflows. It does not provide investment advice.
            Trading involves risk, including possible loss of capital. No guarantees of performance are made.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/quick-start"
              className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950"
            >
              Get Started →
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-slate-700 bg-slate-900/30 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
            >
              See Plans →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools for structured workflows. Not investment advice. Trading involves risk,
          including possible loss of capital. No guarantees of performance.
        </div>
      </footer>
    </main>
  );
}
