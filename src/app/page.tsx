import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-20 pt-24 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-300">
              Direct execution · AI risk engine
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              The first{" "}
              <span className="text-sky-300">
                multi-platform direct-execution AI
              </span>{" "}
              trading platform.
            </h1>
            <p className="mt-5 max-w-xl text-sm text-slate-300 sm:text-base">
              Designed to navigate any market regime with a coordinated bot
              fleet, Mile-Ahead AI, and institutional-grade risk controls — built
              so real users can compound steadily over full market cycles.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/pricing"
                className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/40 hover:bg-amber-300"
              >
                Subscribe Now
              </a>
              <a
                href="/why"
                className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-900/60"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Targets steady growth over full market cycles. Past performance is
              not a guarantee of future results. Trading involves risk of loss.
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
              Recon controlling BUY / SELL / HOLD based on regime and
              confidence.
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
                <p className="text-slate-400">Max Drawdown Target</p>
                <p className="mt-1 text-sm font-semibold text-rose-300">
                  &lt; 2–4% (design target)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why YieldCraft */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Why YieldCraft works in real markets
          </h2>
          <p className="mt-3 text-center text-sm text-slate-300 sm:text-base">
            Direct exchange access, a coordinated bot fleet, and a risk-first
            architecture — built for people who actually trade.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Direct Execution
              </p>
              <h3 className="mt-2 text-sm font-semibold">No middle layers</h3>
              <p className="mt-2 text-xs text-slate-300">
                Orders go straight to Coinbase — no copy trading, no pooled
                funds, fewer moving parts.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Maker-first routing to minimize fees</li>
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
                Recon and Ascend read trend, volatility, and market structure to
                adapt your risk in real time.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Confidence-scored BUY / SELL / HOLD signals</li>
                <li>• Dynamic modes from conservative to aggressive</li>
                <li>• Designed to seek upside while protecting downside</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Risk-First Design
              </p>
              <h3 className="mt-2 text-sm font-semibold">Guardrails baked in</h3>
              <p className="mt-2 text-xs text-slate-300">
                Position sizing, max daily loss, and cooldown logic are built
                into every strategy.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Small, frequent trades with tight risk</li>
                <li>• Account-level daily guardrails</li>
                <li>• Configurable bot mix by risk level</li>
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
            From conservative scalping to intelligent momentum overlays, combine
            bots to match your goals and comfort level.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Low Risk · Core Engine
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Pulse</h3>
              <p className="mt-2 text-xs text-slate-300">
                Conservative BTC engine designed to compound small edges with
                tight risk and minimal drawdown.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Maker-first scalping with micro position sizes</li>
                <li>• Strict daily loss caps and cooldowns</li>
                <li>• Target: 2–4% monthly over a cycle (not guaranteed)</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Intelligence Layer
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Recon</h3>
              <p className="mt-2 text-xs text-slate-300">
                AI market intelligence layer that continuously classifies market
                regimes and feeds signals to every bot.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Confidence-scored BUY / SELL / HOLD</li>
                <li>• Regime tags: trending, mean-reverting, chop</li>
                <li>• Shared brain for Pulse, Ascend, Horizon, Ignition</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Adaptive Overlay
              </p>
              <h3 className="mt-2 text-lg font-semibold">YieldCraft Ascend</h3>
              <p className="mt-2 text-xs text-slate-300">
                Dynamic “Mode C” engine that scales risk up or down based on
                signal confidence and trend strength.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Conservative in chop, aggressive in strong trends</li>
                <li>• Uses Recon&apos;s confidence and bias</li>
                <li>• Designed to seek 10–30%+ months in strong markets (not guaranteed)</li>
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
                high-conviction breakouts with tight risk caps.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>• Fewer, higher-impact trades</li>
                <li>• Built on top of the same Recon brain</li>
                <li>• Intended as add-ons for qualified accounts</li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-slate-400">
            Performance targets are design goals, not promises. Actual results
            vary with market conditions, account size, and configuration.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to put your capital behind an AI engine with real guardrails?
          </h2>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Start with Pulse Starter for $9, or unlock the full multi-bot stack
            with Pro and Elite plans. Cancel anytime.
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
        </div>
      </section>
    </main>
  );
}
