import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-14">
          <p className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-300">
            Dashboard · Control Panel (Read-Only)
          </p>

          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Your system hub —{" "}
            <span className="text-sky-300">built for control, not chaos.</span>
          </h1>

          <p className="mt-4 max-w-3xl text-sm text-slate-300 sm:text-base">
            This dashboard is intentionally read-only for now. You can review
            status, follow the setup path, and keep your workflow clean — without
            mixing website updates with trading execution.
          </p>

          {/* minimal disclosure without "terms/policy" language */}
          <p className="mt-4 max-w-3xl text-xs text-slate-400">
            YieldCraft provides software tools for structured workflows. Trading
            involves risk, including possible loss of capital. No guarantees of
            performance.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/connect-keys"
              className="inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 hover:bg-amber-300"
            >
              Connect Keys
            </Link>

            <Link
              href="/quick-start"
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-900/50"
            >
              Quick Start Guide
            </Link>

            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400 hover:bg-slate-900/50"
            >
              Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-3">
          {/* Status cards */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold">Status</h2>
            <p className="mt-1 text-sm text-slate-300">
              These indicators are intentionally conservative. If something is
              unknown, we show it as “Not connected / Not verified”.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Account
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-100">
                  Connection
                </p>
                <p className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
                  Not verified yet
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Connect your exchange keys to enable a connection check.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Engine
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-100">
                  Armed State
                </p>
                <p className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
                  Disarmed (default)
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  We keep defaults safe. Enabling execution is a separate step.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pulse · BTC
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-100">
                  Strategy Mode
                </p>
                <p className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
                  Rules-based / Conditional
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Built to wait for conditions — not force trades.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Recon
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-100">
                  Signal Feed
                </p>
                <p className="mt-2 inline-flex rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
                  Not connected
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Once connected, this will show “BUY / SELL / HOLD” with
                  confidence.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-slate-100">
                What this dashboard will become
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>• Connection checks (green lights)</li>
                <li>• Read-only live heartbeat + last tick timestamp</li>
                <li>• Trade log viewer + daily rollups</li>
                <li>• Risk settings with safe defaults</li>
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                We’re building this in a way that protects stability: website
                first, execution isolated.
              </p>
            </div>
          </div>

          {/* Setup sidebar */}
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Setup Path</h2>
            <p className="mt-1 text-sm text-slate-300">
              Follow this once. Then let the system run.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step 1
                </p>
                <p className="mt-1 text-sm font-semibold">Pick a plan</p>
                <Link
                  href="/pricing"
                  className="mt-3 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200"
                >
                  Go to Pricing →
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step 2
                </p>
                <p className="mt-1 text-sm font-semibold">Connect exchange keys</p>
                <Link
                  href="/connect-keys"
                  className="mt-3 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200"
                >
                  Open Connect Keys →
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step 3
                </p>
                <p className="mt-1 text-sm font-semibold">Confirm setup</p>
                <Link
                  href="/quick-start"
                  className="mt-3 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200"
                >
                  View Quick Start →
                </Link>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-slate-100">
                The YieldCraft principle
              </p>
              <p className="mt-2 text-sm text-slate-300">
                The people who win long-term don’t try to be right every day.
                They build a system that shows up every day.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Small inputs. Strict rules. Patient execution.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
              >
                ← Back to homepage
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools for structured workflows. Trading
          involves risk, including possible loss of capital. No guarantees of
          performance.
        </div>
      </footer>
    </main>
  );
}
