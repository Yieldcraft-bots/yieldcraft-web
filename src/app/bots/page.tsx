import Link from "next/link";

export const metadata = {
  title: "Bots | YieldCraft",
  description:
    "Meet the YieldCraft engines: intelligence, strategy, execution, and risk — built for control you can audit.",
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

function BotCard({
  name,
  role,
  tag,
  tagTone,
  whatItDoes,
  howItBehaves,
  whyItMatters,
  disclosure,
}: {
  name: string;
  role: string;
  tag: string;
  tagTone: "emerald" | "sky" | "amber" | "rose" | "slate";
  whatItDoes: string[];
  howItBehaves: string[];
  whyItMatters: string[];
  disclosure?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-white">{name}</p>
          <p className="mt-1 text-sm text-slate-300">{role}</p>
        </div>
        <Pill label={tag} tone={tagTone} />
      </div>

      <div className="mt-6 grid gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            What it does
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {whatItDoes.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            How it behaves
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {howItBehaves.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            Why it matters
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {whyItMatters.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {disclosure ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Note
            </p>
            <p className="mt-2 text-sm text-slate-300">{disclosure}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SmallCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{body}</p>
    </div>
  );
}

export default function BotsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* HERO */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-center gap-3">
            <Pill label="Institutional-grade design" tone="sky" />
            <Pill label="Separation of concerns" tone="emerald" />
            <Pill label="Risk-first posture" tone="amber" />
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            Bots & Engines —{" "}
            <span className="text-sky-300">a system that behaves.</span>
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
            YieldCraft wasn’t built to “trade more.” It was built to trade{" "}
            <span className="text-slate-100 font-semibold">with control</span> —
            explicit rules, clear gates, and a layered architecture where intelligence informs strategy,
            strategy guides execution, and risk governs everything.
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

      {/* STORY + PRINCIPLES */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              The why
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Most people don’t need more signals. They need a system that won’t betray them under pressure.
            </h2>
            <p className="mt-4 text-sm text-slate-300 sm:text-base">
              YieldCraft is designed for repeatability. That means fewer moving parts, clear boundaries,
              and decision logic that can explain itself. When the right move is to do nothing, the system can do that — on purpose.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SmallCard
                title="Explicit rules"
                body="If a rule isn’t explicit, it doesn’t exist. This keeps behavior stable and debuggable."
              />
              <SmallCard
                title="Gated execution"
                body="Trading is gated behind switches, safety conditions, and defined failure states."
              />
              <SmallCard
                title="Layered architecture"
                body="Intelligence cannot place orders. Execution cannot invent signals. Risk can override both."
              />
              <SmallCard
                title="Deliberate rollout"
                body="New engines ship behind flags — stability stays protected while capability expands."
              />
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              The four layers
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">1) Intelligence</p>
                <p className="mt-1 text-sm text-slate-400">
                  Recon / Horizon — market context: regime, trend strength, momentum decay, risk conditions.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">2) Strategy</p>
                <p className="mt-1 text-sm text-slate-400">
                  Atlas / Ignition — higher-level plans, allocation logic, and “when not to play” filters.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">3) Execution</p>
                <p className="mt-1 text-sm text-slate-400">
                  Pulse — deterministic order placement, sizing, cooldowns, and safe-mode behavior.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-slate-100">4) Risk & Controls</p>
                <p className="mt-1 text-sm text-slate-400">
                  Stops, kill-switches, exposure caps, and audit logs — built to fail safely.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* CORE ENGINES */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Core engines
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Enough detail to trust it — not enough to copy it.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
              These descriptions focus on behavior, constraints, and intent. The edge is in the orchestration,
              risk posture, and continuous iteration — not a single “secret indicator.”
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <BotCard
            name="Pulse"
            role="Execution Engine — precision over prediction."
            tag="Execution"
            tagTone="amber"
            whatItDoes={[
              "Places orders only when all gates are satisfied.",
              "Enforces sizing rules and cooldown behavior to prevent churn.",
              "Logs decisions so you can see “why it did nothing.”",
            ]}
            howItBehaves={[
              "Deterministic and boring by design — consistency beats adrenaline.",
              "Separates decision inputs from execution actions.",
              "Respects global kill-switches and safety conditions.",
            ]}
            whyItMatters={[
              "Execution quality is where most systems fail (slippage, over-trading, randomness).",
              "A stable execution layer is required before adding complexity.",
              "When signals are wrong, good gates reduce damage.",
            ]}
            disclosure="Pulse is built to execute a plan safely — it does not promise performance."
          />

          <BotCard
            name="Recon"
            role="Market Intelligence — context, not commands."
            tag="Intelligence"
            tagTone="sky"
            whatItDoes={[
              "Measures regime + conditions (trend, momentum decay, volatility context).",
              "Outputs confidence/context signals rather than orders.",
              "Supports “do nothing” decisions when conditions are unfavorable.",
            ]}
            howItBehaves={[
              "Never touches execution directly — separation is intentional.",
              "Designed to be composable: multiple signals can be blended later.",
              "Can be upgraded without risking the execution engine.",
            ]}
            whyItMatters={[
              "Most traders lose by misreading regime shifts and forcing trades.",
              "Context improves selectivity — fewer, higher-quality decisions.",
              "A clean signal interface allows safe iteration and testing.",
            ]}
          />

          <BotCard
            name="Atlas"
            role="Long-Horizon Strategy — time as an edge."
            tag="Strategy"
            tagTone="emerald"
            whatItDoes={[
              "Runs on a longer horizon than Pulse.",
              "Focuses on allocation logic, thesis rules, and slower signals.",
              "Designed to operate independently as a stand-alone mode.",
            ]}
            howItBehaves={[
              "Low frequency by design — discipline over constant interaction.",
              "Treats risk limits as first-class inputs.",
              "Can coordinate with Pulse/Recon without coupling.",
            ]}
            whyItMatters={[
              "Many edges exist on longer horizons where noise is lower.",
              "Portfolio-minded logic reduces impulsive switching.",
              "Separating time horizons prevents mixed, conflicting behavior.",
            ]}
          />
        </div>
      </section>

      {/* ADVANCED / FUTURE ENGINES */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Advanced engines
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Built to scale — without breaking what’s live.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                Additional engines ship behind flags and stability checks. The promise is not speed — it’s controlled expansion.
              </p>
            </div>
            <Pill label="Rolling out deliberately" tone="slate" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Horizon</p>
              <p className="mt-1 text-sm text-slate-400">
                Regime + volatility awareness that helps Recon decide when signals should be discounted.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Ignition</p>
              <p className="mt-1 text-sm text-slate-400">
                Entry timing filters designed to avoid “late” participation and low-quality chase behavior.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Ascend</p>
              <p className="mt-1 text-sm text-slate-400">
                Allocation + risk budgeting logic aimed at scaling size only when conditions justify it.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <p className="text-sm font-semibold text-slate-100">Forge / Edge</p>
              <p className="mt-1 text-sm text-slate-400">
                Experimental engines that must prove stability in controlled rollout before touching production behavior.
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
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 bg-slate-900/30 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
            >
              Go to Dashboard →
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
