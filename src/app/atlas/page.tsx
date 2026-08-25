import Link from "next/link";
import type { ReactNode } from "react";

const ATLAS_STRIPE_LINK =
  process.env.NEXT_PUBLIC_STRIPE_LINK_ATLAS || "/pricing";

export default function AtlasPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-16">
        {/* Top navigation */}
        <div className="mb-10 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to pricing
          </Link>

          <Link
            href="/atlas/quick-start"
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:border-sky-400"
          >
            Atlas Quick Start
          </Link>

          <Link
            href="/atlas/allocation"
            className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
          >
            Set My Allocation
          </Link>

          <a
            href={ATLAS_STRIPE_LINK}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
          >
            Start Atlas
          </a>
        </div>

        {/* Hero */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Multi-asset long-term engine
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-50 md:text-5xl">
            Atlas by YieldCraft
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-7 text-slate-300">
            Build a long-term portfolio around the allocation you choose.
            Atlas combines client-defined portfolio targets with disciplined,
            rules-based accumulation and protected execution infrastructure.
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Configure how you want your Atlas portfolio distributed across the
            supported Atlas asset universe. Atlas then uses that allocation as
            the foundation for future portfolio planning as eligible capital
            becomes available.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Pill>Client-defined allocation</Pill>
            <Pill>Multi-asset portfolio</Pill>
            <Pill>Buy-only accumulation</Pill>
            <Pill>Protected execution</Pill>
            <Pill>Client-controlled exits</Pill>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/atlas/allocation"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Set or Update My Allocation
            </Link>

            <Link
              href="/atlas/quick-start"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              New Client Quick Start
            </Link>
          </div>

          <p className="mt-5 max-w-2xl text-sm text-slate-400">
            Atlas runs independently from Pulse and uses a dedicated Atlas
            account or portfolio structure so long-term capital remains
            separated from active trading systems.
          </p>
        </div>

        {/* Setup path */}
        <section className="mb-8 rounded-3xl border border-sky-500/20 bg-sky-500/[0.06] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Atlas client path
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-50">
            Configure Atlas in a few clear steps
          </h2>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SetupStep
              number="1"
              title="Choose your allocation"
              text="Set the target percentage you want assigned to each available Atlas asset."
            />

            <SetupStep
              number="2"
              title="Connect dedicated Coinbase access"
              text="Use the Atlas connection separately from Pulse and other active systems."
            />

            <SetupStep
              number="3"
              title="Confirm readiness"
              text="Review your portfolio configuration and confirm your Atlas setup is ready."
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/atlas/allocation"
              className="rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
            >
              Configure Allocation
            </Link>

            <Link
              href="/atlas/quick-start"
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
            >
              View Full Setup Guide
            </Link>
          </div>
        </section>

        {/* Who it is for */}
        <div className="mb-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <p className="text-sm font-semibold text-emerald-300">
            Who Atlas is for
          </p>

          <div className="mt-3 space-y-1.5 text-sm text-slate-300">
            <p>
              • You want a disciplined way to build a long-term portfolio.
            </p>
            <p>
              • You want control over how your portfolio is allocated.
            </p>
            <p>
              • You prefer gradual accumulation over trying to predict every
              market move.
            </p>
            <p>
              • You want long-term capital separated from active trading.
            </p>
          </div>

          <p className="mt-5 text-sm font-semibold text-rose-300">
            Who Atlas is NOT for
          </p>

          <div className="mt-3 space-y-1.5 text-sm text-slate-300">
            <p>• You want constant trades or daily action.</p>
            <p>• You expect immediate purchases after funding.</p>
            <p>• You expect guaranteed returns.</p>
            <p>• You want Atlas to automatically decide when you should sell.</p>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-6">
          <Section title="How Atlas Works">
            <div className="space-y-3 text-slate-300">
              <p>
                <span className="font-semibold text-slate-100">
                  1. You choose the portfolio.
                </span>{" "}
                Set target percentages across the Atlas asset universe. Your
                saved targets must total exactly 100%.
              </p>

              <p>
                <span className="font-semibold text-slate-100">
                  2. Atlas observes available capital.
                </span>{" "}
                Atlas uses the dedicated account connection to evaluate
                available funding for the long-term portfolio.
              </p>

              <p>
                <span className="font-semibold text-slate-100">
                  3. Capital accumulates toward your targets.
                </span>{" "}
                Small amounts can remain pending until they meet the applicable
                minimum needed for an eligible purchase.
              </p>

              <p>
                <span className="font-semibold text-slate-100">
                  4. Protected controls remain between planning and execution.
                </span>{" "}
                Saving an allocation does not itself submit an order.
              </p>
            </div>

            <p className="mt-5 text-slate-400">
              <span className="font-semibold text-slate-200">
                The goal is disciplined portfolio building, not constant
                activity.
              </span>
            </p>
          </Section>

          <Section title="Your Allocation, Your Portfolio">
            <p className="text-slate-300">
              Atlas gives you direct control over the target percentages used
              to build your long-term portfolio.
            </p>

            <p className="mt-3 text-slate-400">
              You can review and update your allocation from the Atlas
              allocation page. A valid portfolio must total exactly 100%.
            </p>

            <div className="mt-5">
              <Link
                href="/atlas/allocation"
                className="inline-flex rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
              >
                Set My Allocation
              </Link>
            </div>
          </Section>

          <Section title="Multi-Asset Portfolio">
            <p className="text-slate-300">
              Atlas is being built as a multi-asset portfolio system spanning
              digital assets, public equities, and selected additional
              investment exposures supported by the Atlas platform.
            </p>

            <p className="mt-3 text-slate-400">
              Asset availability can differ by product readiness, account
              capability, market session, exchange support, and execution
              eligibility. An asset appearing in portfolio configuration does
              not guarantee that an immediate order can be placed.
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Atlas evaluates execution eligibility separately from portfolio
              configuration and fails closed when required conditions are not
              met.
            </p>
          </Section>

          <Section title="You Control Selling and Withdrawals">
            <p className="text-slate-300">
              Atlas is designed around accumulation. It does not automatically
              decide when you should take profit or exit a position.
            </p>

            <p className="mt-3 text-slate-400">
              You remain responsible for your own selling, withdrawals,
              investment objectives, tax considerations, and account-level
              decisions.
            </p>
          </Section>

          <Section title="Dedicated Atlas Account Structure">
            <p className="text-slate-300">
              <span className="font-semibold text-slate-200">
                Atlas requires a separate Coinbase account or dedicated
                portfolio from other YieldCraft execution systems.
              </span>{" "}
              This separation protects accounting, credentials, and strategy
              boundaries.
            </p>

            <p className="mt-3 text-slate-400">
              Do not use the same API credentials or active trading funds for
              both Atlas and Pulse.
            </p>
          </Section>

          <Section title="Existing Atlas Client?">
            <p className="text-slate-300">
              Your allocation is now a core part of Atlas setup. Configure or
              update your portfolio targets, then review the resulting
              portfolio preview.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/atlas/allocation"
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
              >
                Set / Update Allocation
              </Link>

              <Link
                href="/atlas/preview"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                Review Portfolio Preview
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                Dashboard
              </Link>
            </div>
          </Section>

          <Section title="Pricing">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-slate-50">$9</p>

                <p className="text-xs text-slate-500">
                  per month · flat pricing
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Atlas is designed as a dedicated long-term portfolio
                  membership.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/atlas/quick-start"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500"
                >
                  Atlas Quick Start
                </Link>

                <a
                  href={ATLAS_STRIPE_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:bg-amber-300"
                >
                  Start Atlas
                </a>
              </div>
            </div>
          </Section>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="text-xs leading-5 text-slate-500">
              Disclaimer: Atlas by YieldCraft is an automation and portfolio
              discipline system. It does not guarantee returns or eliminate
              investment risk. Markets can lose value. Asset availability and
              execution eligibility may vary. Clients remain responsible for
              funding, withdrawals, selling decisions, investment objectives,
              and tax considerations.
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
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="text-lg font-semibold text-slate-50">
        {title}
      </h2>

      <div className="mt-3">
        {children}
      </div>
    </section>
  );
}

function Pill({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
      {children}
    </span>
  );
}

function SetupStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400 text-xs font-bold text-slate-950">
          {number}
        </span>

        <div>
          <p className="text-sm font-semibold text-slate-100">
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}