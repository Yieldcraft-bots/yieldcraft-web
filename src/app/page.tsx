import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-20 pt-24 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-300">
              Direct execution · risk-first automation
            </p>

            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              A system that waits —{" "}
              <span className="text-sky-300">so you don’t have to react.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm text-slate-300 sm:text-base">
              Built to support disciplined decision-making, not prediction — with
              clear rules, patient execution, and risk-first guardrails designed
              to reduce emotional trading.
            </p>

            {/* Above-the-fold disclosure (highest value liability shield) */}
            <p className="mt-4 text-xs text-slate-400">
              YieldCraft provides software tools and systems — not financial
              advice. Trading involves risk, including possible loss of capital.
              No guarantees of performance.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/pricing"
                className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/40 hover:bg-amber-300"
              >
                See Plans
              </a>
              <a
                href="/quick-start"
                className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:text-slate-50"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Not an investment advisor. Nothing here is a recommendation to buy
              or sell. You are responsible for your own decisions and risk.
            </p>
          </div>

          <div className="mt-10 w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-sky-500/10 lg:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Live Engine Snapshot
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">
              Pulse + Recon · BTC Engine
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Orders route directly to Coinbase using maker-first logic, with
              Recon controlling BUY / SELL / HOLD based on regime and confidence.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Current Regime</p>
                <p className="mt-1 text-sm font-semibold text-sky-300">
                  Trending / BTC
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Bots Active</p>
                <p className="mt-1 text-sm font-semibold">
                  Pulse · Recon · Ascend
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Risk Mode</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  Small Account / Guardrails On
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950/60 p-3">
                <p className="text-slate-400">Execution</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  Rules-Based / Conditional
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-500">
              Snapshot is illustrative of system configuration and does not imply
              performance or results.
            </p>
          </div>
        </div>
      </section>

      {/* Why YieldCraft */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Why YieldCraft is built for real markets
          </h2>
          <p className="mt-3 text-center text-sm text-slate-300 sm:text-base">
            Direct exchange access, a coordinated bot fleet, and a risk-first
            architecture — built to reduce reaction-based trading.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Direct Execution
              </p>
              <h3 className="mt-2 text-sm font-semibold">No middle layers</h3>
              <p className="mt-2 text-xs text-slate-300">
                Orders go straight to Coinbase — no pooled funds, fewer moving
                parts.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Maker-first routing to help reduce fees</li>
                <li>• Clean, auditable logs per trade</li>
                <li>• No withdrawal permissions on API keys</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Mile-Ahead AI
              </p>
              <h3 className="mt-2 text-sm font-semibold">
                Regime-aware intelligence
              </h3>
              <p className="mt-2 text-xs text-slate-300">
                Recon and Ascend classify trend, volatility, and structure to
                adapt risk behavior over time.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Confidence-scored BUY / SELL / HOLD signals</li>
                <li>• Dynamic modes from conservative to aggressive</li>
                <li>• Designed to prioritize survivability first</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Risk-First Design
              </p>
              <h3 className="mt-2 text-sm font-semibold">Guardrails baked in</h3>
              <p className="mt-2 text-xs text-slate-300">
                Position sizing, cooldown logic, and risk limits are built into
                every strategy configuration.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Small, structured sizing options</li>
                <li>• Account-level guardrails</li>
                <li>• Configurable bot mix by risk preference</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Strategies */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Strategies tuned to your risk
          </h2>
          <p className="mt-3 text-center text-sm text-slate-300 sm:text-base">
            Combine bots to match your goals and comfort level — with risk-first
            defaults and configurable guardrails.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Core Engine
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Pulse</h3>
              <p className="mt-2 text-xs text-slate-300">
                Conservative BTC execution engine designed for small, structured
                decisions with tight risk controls.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Maker-first logic with micro sizing options</li>
                <li>• Cooldowns and guardrails to reduce overtrading</li>
                <li>• Designed for consistency of process (not guaranteed)</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Intelligence Layer
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Recon</h3>
              <p className="mt-2 text-xs text-slate-300">
                Market intelligence layer that classifies regimes and provides
                confidence-scored signals to inform bot behavior.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Confidence-scored BUY / SELL / HOLD</li>
                <li>• Regime tags: trending, mean-reverting, chop</li>
                <li>• Shared brain for multiple engines</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Adaptive Overlay
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Ascend</h3>
              <p className="mt-2 text-xs text-slate-300">
                Adaptive risk overlay that can scale behavior up or down based
                on signal confidence and trend conditions.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• More conservative in chop, more active in trends</li>
                <li>• Uses Recon&apos;s confidence and bias</li>
                <li>• Intended for qualified accounts (not guaranteed)</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-pink-300">
                Trend &amp; Momentum
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                Horizon &amp; Ignition
              </h3>
              <p className="mt-2 text-xs text-slate-300">
                Horizon focuses on sustained swings; Ignition looks for
                higher-conviction breakouts with risk limits.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Fewer, higher-intent trades</li>
                <li>• Built on top of the same Recon brain</li>
                <li>• Add-ons for qualified configurations</li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-slate-400">
            YieldCraft does not guarantee results. Actual outcomes vary with
            market conditions, configuration, fees, and user decisions.
          </p>
        </div>
      </section>

      {/* Important Disclosures */}
      <section className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-center text-xl font-semibold sm:text-2xl">
            Important Disclosures
          </h2>

          <div className="mx-auto mt-6 max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200">
            <ul className="space-y-3 text-slate-300">
              <li>
                <span className="font-semibold text-slate-100">
                  Not investment advice:
                </span>{" "}
                YieldCraft provides software tools and systems for structured
                trading workflows. Nothing on this site is financial, investment,
                tax, or legal advice.
              </li>
              <li>
                <span className="font-semibold text-slate-100">Risk of loss:</span>{" "}
                Trading involves risk, and losses are possible, including loss of
                principal.
              </li>
              <li>
                <span className="font-semibold text-slate-100">No guarantees:</span>{" "}
                YieldCraft does not guarantee performance, profits, or protection
                from losses. Any examples, targets, or design goals are
                illustrative and may not reflect real results.
              </li>
              <li>
                <span className="font-semibold text-slate-100">
                  User responsibility:
                </span>{" "}
                You are solely responsible for your decisions, configuration, and
                risk management. Only use capital you can afford to risk.
              </li>
              <li>
                <span className="font-semibold text-slate-100">
                  Third-party platforms:
                </span>{" "}
                Execution relies on third-party exchanges and infrastructure that
                may experience outages, slippage, fees, latency, or other
                limitations.
              </li>
            </ul>

            <p className="mt-5 text-xs text-slate-400">
              By using YieldCraft, you acknowledge these risks and that outcomes
              vary with market conditions, fees, configuration, and user
              decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to run a rules-based system with real guardrails?
          </h2>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Start with a plan that matches your comfort level. Cancel anytime.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="/pricing"
              className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/40 hover:bg-amber-300"
            >
              See Plans
            </a>
            <a
              href="/quick-start"
              className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-900/60"
            >
              Quick Start Guide
            </a>
          </div>

          <p className="mt-6 text-[11px] text-slate-500">
            Educational and informational only. Not investment advice. Trading
            involves risk, including possible loss of capital.
          </p>
        </div>
      </section>

      {/* Footer micro-disclaimer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools for structured workflows. Not
          investment advice. Trading involves risk, including possible loss of
          capital. No guarantees of performance.
        </div>
      </footer>
    </main>
  );
}
