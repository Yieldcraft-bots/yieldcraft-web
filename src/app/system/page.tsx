// src/app/system/page.tsx
import Link from "next/link";

export const metadata = {
  title: "How It Works | YieldCraft",
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
            <Pill label="How It Works" tone="sky" />
            <Pill label="Separation of Concerns" tone="emerald" />
            <Pill label="Risk-First Design" tone="amber" />
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            How YieldCraft Works —{" "}
            <span className="text-sky-300">control you can audit.</span>
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            YieldCraft is a layered decision system: intelligence informs strategy,
            strategy guides execution, and risk gates everything. The goal isn’t constant action —
            it’s disciplined, controlled behavior.
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

      {/* SYSTEM LAYERS */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            title="Pulse"
            subtitle="Execution Engine — precision over prediction."
            tag="Execution"
            tagTone="amber"
            bullets={[
              "Executes only when all conditions are satisfied",
              "Strict sizing, cooldowns, and safety gates",
              "Deterministic behavior — no randomness",
            ]}
          />

          <Card
            title="Recon"
            subtitle="Market Intelligence — context, not commands."
            tag="Intelligence"
            tagTone="sky"
            bullets={[
              "Measures regime, trend, and momentum",
              "Outputs confidence signals, not trades",
              "Supports do-nothing decisions",
            ]}
          />

          <Card
            title="Sentinel"
            subtitle="Long-Term Strategy — time as an edge."
            tag="Strategy"
            tagTone="emerald"
            bullets={[
              "Long-horizon accumulation and allocation logic",
              "Lower frequency, thesis-driven decisions",
              "Designed for discipline, not activity",
            ]}
          />
        </div>
      </section>

      {/* RISK */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            Risk is the product
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Risk management is not a feature. It is the foundation.
          </h2>

          <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
            YieldCraft prioritizes survivability: safety gates, explicit constraints,
            and transparent behavior. The system is built to fail safely — and explain why.
          </p>
        </div>
      </section>
    </main>
  );
}