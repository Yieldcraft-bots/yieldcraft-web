import Link from "next/link";

export default function DashboardPage() {
  // NOTE: read-only UI. This is NOT tied to trading.
  // For now we treat "Connected" as "site reachable / dashboard online".
  const connected = true; // later: wire to /api/health
  const lastCheck = new Date();

  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Dashboard · Control Panel (Read-Only)
              </span>

              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  connected
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                    : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    connected ? "bg-emerald-400" : "bg-rose-400",
                  ].join(" ")}
                />
                {connected ? "CONNECTED" : "NOT CONNECTED"}
              </span>

              <span className="text-xs text-slate-400">
                Last check: <span className="text-slate-200">{fmt(lastCheck)}</span>
              </span>

              <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/70"
                title="This is a UI button for now (no trading). We'll wire it later."
              >
                Re-check
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
              <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Your system hub —{" "}
                  <span className="text-sky-300">simple, clear, and safe.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                  Follow the setup path once. After that, the system runs on rules —
                  not emotions.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href="/connect-keys"
                    className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 hover:bg-amber-300"
                  >
                    Connect Keys
                  </Link>
                  <Link
                    href="/quick-start"
                    className="rounded-full border border-slate-700 bg-slate-900/30 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
                  >
                    Quick Start
                  </Link>
                  <Link
                    href="/pricing"
                    className="rounded-full border border-slate-700 bg-slate-900/30 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
                  >
                    Plans
                  </Link>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  This dashboard is read-only by design. It does not enable trading from here.
                </p>
              </div>

              {/* What this means */}
              <aside className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                  What the colors mean
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  <li className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30">
                      ✓
                    </span>
                    <span>
                      <span className="font-semibold text-slate-50">Green</span> = dashboard is reachable
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30">
                      ✕
                    </span>
                    <span>
                      <span className="font-semibold text-slate-50">Red</span> = not reachable / failing
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-slate-200 ring-1 ring-slate-700">
                      🛡️
                    </span>
                    <span>
                      Trading stays <span className="font-semibold">OFF</span> from this page (safe)
                    </span>
                  </li>
                </ul>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
                  Next upgrade: this check will also confirm exchange connection — still read-only.
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Status Grid (tight) */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Status</h2>
              <p className="mt-1 text-sm text-slate-400">
                If something is unknown, we show it as “Not connected / Not verified”.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Connection */}
            <div
              className={[
                "rounded-3xl border bg-slate-900/40 p-5",
                connected
                  ? "border-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
                  : "border-rose-500/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Account
                </p>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    connected
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-rose-500/15 text-rose-200",
                  ].join(" ")}
                >
                  {connected ? "GREEN" : "RED"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Connection</p>
              <p className="mt-1 text-sm text-slate-300">
                {connected
                  ? "Site reachable. You can proceed to connect exchange keys."
                  : "Not reachable yet. Try again shortly."}
              </p>
            </div>

            {/* Engine */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Engine
                </p>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                  —
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Armed State</p>
              <p className="mt-1 text-sm text-slate-300">
                Disarmed (default). We keep defaults safe. Enabling execution is a separate step.
              </p>
            </div>

            {/* Setup Path */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Setup Path
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Do this once. Then let the system run.
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Step 1
                  </p>
                  <p className="mt-1 font-semibold">Pick a plan</p>
                  <Link href="/pricing" className="mt-2 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200">
                    Go to Pricing →
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Step 2
                  </p>
                  <p className="mt-1 font-semibold">Connect exchange keys</p>
                  <Link href="/connect-keys" className="mt-2 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200">
                    Open Connect Keys →
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Step 3
                  </p>
                  <p className="mt-1 font-semibold">Confirm setup</p>
                  <Link href="/quick-start" className="mt-2 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200">
                    View Quick Start →
                  </Link>
                </div>
              </div>
            </div>

            {/* Pulse */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pulse · BTC
                </p>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                  —
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Strategy Mode</p>
              <p className="mt-1 text-sm text-slate-300">
                Rules-based / conditional. Built to wait for conditions — not force trades.
              </p>
            </div>

            {/* Recon */}
            <div className="rounded-3xl border border-rose-500/20 bg-slate-900/40 p-5 lg:col-span-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Recon
                </p>
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                  RED
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Signal Feed</p>
              <p className="mt-1 text-sm text-slate-300">
                Not connected yet. Once connected, this will show BUY / SELL / HOLD with confidence.
              </p>
            </div>

            {/* Principle */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                The YieldCraft principle
              </p>
              <p className="mt-3 text-sm text-slate-200">
                Long-term wins come from showing up with a system — not trying to be right every day.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Small inputs. Strict rules. Patient execution.
              </p>

              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
                >
                  ← Back to homepage
                </Link>
              </div>
            </div>
          </div>

          {/* Future */}
          <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/30 p-5">
            <p className="text-sm font-semibold">What this dashboard will become</p>
            <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <li>• Connection checks (clear green lights)</li>
              <li>• Read-only heartbeat + last tick timestamp</li>
              <li>• Trade log viewer + daily rollups</li>
              <li>• Risk settings with safe defaults</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Built to protect stability: website updates first, execution isolated.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools for structured workflows. Not investment advice.
          Trading involves risk, including possible loss of capital. No guarantees of performance.
        </div>
      </footer>
    </main>
  );
}
