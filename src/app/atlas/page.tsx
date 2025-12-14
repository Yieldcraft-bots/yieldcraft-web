// src/app/atlas/page.tsx
import Link from "next/link";

export default function AtlasPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Top navigation */}
        <div className="mb-10 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to pricing
          </Link>
          <Link
            href="/quick-start"
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
          >
            View Quick Start guide
          </Link>
        </div>

        {/* HERO */}
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
            Long-term engine
          </p>

          <h1 className="mt-3 text-3xl md:text-5xl font-bold text-slate-50">
            YieldCraft Atlas
          </h1>

          <p className="mt-4 max-w-2xl text-slate-400">
            Atlas is a buy-only, weekly capital allocator designed to help clients
            build long-term positions through disciplined accumulation into
            large-cap, highly liquid digital assets — without relying on timing
            or predictions.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
              Buy-only
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
              Weekly execution
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
              Liquidity-first
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
              Client-controlled exits
            </span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="grid gap-6">
          <Section title="How Atlas Works">
            <ul className="space-y-2 text-slate-300">
              <li>• Atlas runs on a fixed weekly cadence.</li>
              <li>
                • Capital is allocated across a limited universe using
                rules-based target ranges.
              </li>
              <li>
                • Portfolio balance is maintained through future buys — not
                selling existing positions.
              </li>
              <li>
                • No leverage, no reactive trading, no daily monitoring required.
              </li>
            </ul>

            <p className="mt-4 text-slate-400">
              <span className="font-semibold text-slate-200">
                Time, not timing, does the heavy lifting.
              </span>
            </p>
          </Section>

          <Section title="You Control Profit Taking">
            <p className="text-slate-300">
              <span className="font-semibold text-slate-200">
                You are always in control of when you take profit.
              </span>{" "}
              Atlas never sells assets or decides when to exit positions. Clients
              choose if, when, and how positions are reduced or exited based on
              their own goals, timeline, and tax considerations.
            </p>

            <p className="mt-3 text-slate-400">
              Atlas helps you build positions with discipline — it does not tell
              you when your journey is complete.
            </p>
          </Section>

          <Section title="What Happens If You Sell">
            <p className="text-slate-300">
              If you reduce or exit a position manually, Atlas automatically
              adjusts future allocations based on current holdings. No reset is
              required.
            </p>

            <p className="mt-3 text-slate-400">
              Atlas is designed to adapt to client decisions — not override them.
            </p>
          </Section>

          <Section title="Asset Selection & Liquidity">
            <p className="text-slate-300">
              Atlas allocates only among a small universe of large-cap, highly
              liquid digital assets. Liquidity is a core requirement so clients
              can exit efficiently when they choose.
            </p>

            <ul className="mt-4 space-y-2 text-slate-300">
              <li>• Market capitalization stability</li>
              <li>• Deep spot liquidity and execution reliability</li>
              <li>• Network maturity and long-term relevance</li>
              <li>• Exchange availability and operational durability</li>
            </ul>

            <p className="mt-4 text-xs text-slate-500">
              Asset inclusion is reviewed periodically and adjusted deliberately.
              Atlas does not chase trends or react to short-term price movement.
            </p>
          </Section>

          <Section title="Account Structure (Required)">
            <p className="text-slate-300">
              <span className="font-semibold text-slate-200">
                Atlas requires a separate exchange account or portfolio from
                active trading bots.
              </span>{" "}
              This separation prevents risk bleed and preserves clean accounting.
            </p>

            <p className="mt-3 text-slate-400">
              Atlas manages time-based capital. Active bots manage volatility.
              These systems never share funds.
            </p>
          </Section>

          <Section title="Pricing">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-slate-50">$9</p>
                <p className="text-xs text-slate-500">per month · flat pricing</p>
                <p className="mt-2 text-sm text-slate-400">
                  Atlas is priced to respect small accounts.
                </p>
              </div>

              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
              >
                See all plans
              </Link>
            </div>
          </Section>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="text-xs text-slate-500">
              Disclaimer: YieldCraft Atlas is an automation and discipline tool.
              It does not guarantee returns. Digital assets carry risk. Clients
              remain responsible for funding, withdrawals, and any manual selling
              decisions.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
