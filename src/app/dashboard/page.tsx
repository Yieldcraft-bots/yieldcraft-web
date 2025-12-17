"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConnState = "checking" | "connected" | "not_connected";

function Badge({ state }: { state: ConnState }) {
  if (state === "checking") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
        <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-300" />
        Checking…
      </span>
    );
  }

  if (state === "connected") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        Connected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
      <span className="h-2 w-2 rounded-full bg-rose-300" />
      Not connected
    </span>
  );
}

function Card({
  title,
  kicker,
  status,
  sub,
  hint,
}: {
  title: string;
  kicker: string;
  status: string;
  sub?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 shadow-lg shadow-slate-950/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
        {kicker}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-50">{title}</h3>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-100">
        {status}
      </div>

      {sub ? <p className="mt-3 text-xs text-slate-300">{sub}</p> : null}
      {hint ? <p className="mt-3 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [conn, setConn] = useState<ConnState>("checking");
  const [lastCheck, setLastCheck] = useState<string>("");

  async function runCheck() {
    setConn("checking");
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      // Any 2xx = “site is healthy”. Later we can evolve /api/health to include
      // exchange verification, but dashboard stays read-only either way.
      if (res.ok) {
        setConn("connected");
      } else {
        setConn("not_connected");
      }
    } catch {
      setConn("not_connected");
    } finally {
      setLastCheck(new Date().toLocaleString());
    }
  }

  useEffect(() => {
    runCheck();
    // optional: re-check every 30s (safe + read-only)
    const id = window.setInterval(runCheck, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroTitle =
    conn === "connected"
      ? "✅ You’re connected."
      : conn === "checking"
      ? "Checking connection…"
      : "❌ Not connected yet.";

  const heroLine =
    conn === "connected"
      ? "You’re good. Next: follow the setup path once, then let the system run."
      : "Do Step 2 (Connect Keys). When it works, this turns green automatically.";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-20">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex items-center rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-300">
                Dashboard • Control Panel (Read-Only)
              </p>

              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Your system hub —{" "}
                <span className="text-sky-300">built for control, not chaos.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm text-slate-300 sm:text-base">
                {heroLine}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Badge state={conn} />
                <span className="text-xs text-slate-400">
                  {lastCheck ? `Last check: ${lastCheck}` : ""}
                </span>
                <button
                  onClick={runCheck}
                  className="ml-0 inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900/70"
                >
                  Re-check
                </button>
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-100">
                {heroTitle}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/connect-keys"
                  className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/40 transition hover:bg-amber-300"
                >
                  Connect Keys
                </Link>
                <Link
                  href="/quick-start"
                  className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900/60"
                >
                  Quick Start Guide
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900/60"
                >
                  Plans
                </Link>
              </div>
            </div>

            <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/55 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                What this means
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li>• Green = site health check passes ✅</li>
                <li>• Red = not reachable / failing ❌</li>
                <li>• Trading stays OFF from this page (safe)</li>
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                Next upgrade (later): we’ll extend /api/health to verify exchange
                connection too — still read-only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <section className="bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 lg:grid-cols-3">
          {/* Left: Status */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold">Status</h2>
            <p className="mt-2 text-sm text-slate-300">
              Simple signals. If it’s unknown, we show it as “Not connected”.
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Card
                kicker="Account"
                title="Connection"
                status={
                  conn === "connected"
                    ? "✅ Connected"
                    : conn === "checking"
                    ? "🟡 Checking…"
                    : "❌ Not connected"
                }
                sub="This will go green when the system can verify connectivity."
                hint="If you just connected keys, give it a moment — then hit Re-check."
              />

              <Card
                kicker="Engine"
                title="Trading"
                status="OFF (Safe)"
                sub="We do not enable trading from the website build path."
                hint="Execution is a separate step (later), behind flags."
              />

              <Card
                kicker="Pulse • BTC"
                title="Strategy Mode"
                status="Rules-based / Conditional"
                sub="Built to wait for conditions — not force trades."
              />

              <Card
                kicker="Recon"
                title="Signal Feed"
                status="Not connected"
                sub='Once connected, this will show "BUY / SELL / HOLD" with confidence.'
                hint="Website-first. Signals + execution stay isolated."
              />
            </div>

            <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-lg font-semibold text-slate-50">
                What this dashboard will become
              </h3>
              <ul className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <li>• Connection checks (green lights)</li>
                <li>• Read-only heartbeat + last tick timestamp</li>
                <li>• Trade log viewer + daily rollups</li>
                <li>• Safe defaults + risk settings (read-only)</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Built to protect stability: website updates first, execution isolated.
              </p>
            </div>
          </div>

          {/* Right: Setup Path */}
          <aside className="lg:col-span-1">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6">
              <h2 className="text-xl font-semibold">Setup Path</h2>
              <p className="mt-2 text-sm text-slate-300">
                Follow this once. Then let the system run.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Step 1
                  </p>
                  <p className="mt-1 text-base font-semibold">Pick a plan</p>
                  <Link
                    href="/pricing"
                    className="mt-3 inline-flex items-center text-sm font-semibold text-sky-300 hover:text-sky-200"
                  >
                    Go to Pricing →
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Step 2
                  </p>
                  <p className="mt-1 text-base font-semibold">Connect exchange keys</p>
                  <Link
                    href="/connect-keys"
                    className="mt-3 inline-flex items-center text-sm font-semibold text-sky-300 hover:text-sky-200"
                  >
                    Open Connect Keys →
                  </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Step 3
                  </p>
                  <p className="mt-1 text-base font-semibold">Confirm setup</p>
                  <Link
                    href="/quick-start"
                    className="mt-3 inline-flex items-center text-sm font-semibold text-sky-300 hover:text-sky-200"
                  >
                    View Quick Start →
                  </Link>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
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
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900/50"
                >
                  ← Back to homepage
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft — dashboard is read-only while we harden stability.
        </div>
      </footer>
    </main>
  );
}
