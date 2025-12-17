"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ConnState = "checking" | "connected" | "disconnected";

function formatTimestamp(d: Date | null) {
  if (!d) return "—";
  try {
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

/**
 * We treat "CONNECTED" as: the site can respond to a request.
 * - If fetch succeeds (any HTTP status), it's connected (reachable).
 * - If fetch throws (network error), it's not connected.
 *
 * This keeps it ultra-simple + avoids needing any trading/exchange checks.
 */
async function runReachabilityCheck(timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Any response means the site is reachable.
    // /api/health may or may not exist; 404 still proves reachability.
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    // If we got a response at all, we consider it reachable.
    return !!res;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function Badge({ state }: { state: ConnState }) {
  if (state === "checking") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-100 shadow-[0_0_0_1px_rgba(250,204,21,0.25),0_10px_35px_rgba(250,204,21,0.18)]">
        <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-300" />
        CHECKING…
      </span>
    );
  }

  if (state === "connected") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-5 py-2.5 text-sm font-extrabold text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_14px_45px_rgba(16,185,129,0.30)]">
        <span className="h-3.5 w-3.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
        ✅ CONNECTED
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/15 px-5 py-2.5 text-sm font-extrabold text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.35),0_14px_45px_rgba(244,63,94,0.25)]">
      <span className="h-3.5 w-3.5 rounded-full bg-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.55)]" />
      ❌ NOT CONNECTED
    </span>
  );
}

function StatusCard({
  title,
  value,
  desc,
  state,
}: {
  title: string;
  value: string;
  desc: string;
  state: ConnState;
}) {
  const isGood = state === "connected";
  const isBad = state === "disconnected";
  const ring = isGood
    ? "border-emerald-300/30 bg-emerald-400/5 shadow-[0_0_0_1px_rgba(52,211,153,0.12),0_20px_70px_rgba(16,185,129,0.10)]"
    : isBad
    ? "border-rose-300/30 bg-rose-400/5 shadow-[0_0_0_1px_rgba(251,113,133,0.12),0_20px_70px_rgba(244,63,94,0.10)]"
    : "border-white/10 bg-white/5";

  const pill = isGood
    ? "bg-emerald-400/15 text-emerald-100 border-emerald-300/30"
    : isBad
    ? "bg-rose-400/15 text-rose-100 border-rose-300/30"
    : "bg-white/5 text-white/70 border-white/10";

  return (
    <div className={`rounded-3xl border p-6 ${ring}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            {title}
          </p>
          <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-white/65">{desc}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${pill}`}>
          {isGood ? "GREEN" : isBad ? "RED" : "—"}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [state, setState] = useState<ConnState>("checking");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const headline = useMemo(() => {
    if (state === "connected") return "You're good.";
    if (state === "disconnected") return "Something’s not reachable.";
    return "Checking status…";
  }, [state]);

  const subline = useMemo(() => {
    if (state === "connected")
      return "Next: follow the setup path once, then let the system run.";
    if (state === "disconnected")
      return "If this stays red, refresh the page, then check Vercel deploy status.";
    return "This takes a moment.";
  }, [state]);

  async function recheck() {
    setState("checking");
    const ok = await runReachabilityCheck();
    setState(ok ? "connected" : "disconnected");
    setLastCheck(new Date());
  }

  useEffect(() => {
    // auto-check on load
    void recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#040914] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute -bottom-48 right-[-240px] h-[620px] w-[620px] rounded-full bg-emerald-400/10 blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                Dashboard • Control Panel (Read-Only)
              </div>

              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
                Your system hub —{" "}
                <span className="text-cyan-300">built for control, not chaos.</span>
              </h1>

              <p className="mt-4 max-w-2xl text-base text-white/70">
                {headline} <span className="text-white/60">Next:</span> {subline}
              </p>

              {/* Big status row */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Badge state={state} />
                <div className="text-sm text-white/55">
                  Last check: <span className="text-white/75">{formatTimestamp(lastCheck)}</span>
                </div>
                <button
                  onClick={recheck}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  Re-check
                </button>
              </div>

              <div className="mt-5 text-sm text-white/60">
                {state === "connected" ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-emerald-300">✅</span>
                    <span className="font-semibold text-emerald-100">You’re connected.</span>
                    <span className="text-white/50">(Green means the site is reachable.)</span>
                  </div>
                ) : state === "disconnected" ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-rose-300">❌</span>
                    <span className="font-semibold text-rose-100">Not reachable right now.</span>
                    <span className="text-white/50">(Red means this check failed.)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-yellow-300">⏳</span>
                    <span className="font-semibold text-yellow-100">Checking…</span>
                  </div>
                )}
              </div>

              {/* Primary actions */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/connect-keys"
                  className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_12px_40px_rgba(250,204,21,0.22)] transition hover:brightness-110"
                >
                  Connect Keys
                </Link>

                <Link
                  href="/quick-start"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  Quick Start Guide
                </Link>

                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  Plans
                </Link>
              </div>

              <p className="mt-6 text-xs text-white/45">
                This dashboard is read-only by design. It does not enable trading from here.
              </p>
            </div>

            {/* What this means card */}
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                What this means
              </p>

              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-300">✅</span>
                  <span>
                    <span className="font-semibold text-white">Green</span> = site health check passes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-300">❌</span>
                  <span>
                    <span className="font-semibold text-white">Red</span> = not reachable / failing
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/60">🛡️</span>
                  <span>Trading stays OFF from this page (safe)</span>
                </li>
              </ul>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/55">
                Next upgrade (later): extend this check to verify exchange connection too — still
                read-only.
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Status grid */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-2xl font-semibold">Status</h2>
          <p className="mt-2 text-sm text-white/65">
            Simple signals. If something is unknown, we show it as “Not connected / Not verified”.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
              <StatusCard
                title="Account"
                value={state === "connected" ? "Connection" : "Connection"}
                desc={
                  state === "connected"
                    ? "Site reachable. You can proceed to connect exchange keys."
                    : state === "disconnected"
                    ? "Can’t reach the site health check. Try Re-check."
                    : "Running health check…"
                }
                state={state}
              />

              <StatusCard
                title="Engine"
                value="Armed State"
                desc="Disarmed (default). We keep defaults safe. Enabling execution is a separate step."
                state={"checking"}
              />

              <StatusCard
                title="Pulse • BTC"
                value="Strategy Mode"
                desc="Rules-based / Conditional. Built to wait for conditions — not force trades."
                state={"checking"}
              />

              <StatusCard
                title="Recon"
                value="Signal Feed"
                desc="Not connected. Once connected, this will show BUY / SELL / HOLD with confidence."
                state={"disconnected"}
              />
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Setup Path
                </p>
                <p className="mt-2 text-sm text-white/70">Follow this once. Then let the system run.</p>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold text-white/60">STEP 1</p>
                    <p className="mt-1 font-semibold">Pick a plan</p>
                    <Link href="/pricing" className="mt-2 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                      Go to Pricing →
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold text-white/60">STEP 2</p>
                    <p className="mt-1 font-semibold">Connect exchange keys</p>
                    <Link href="/connect-keys" className="mt-2 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                      Open Connect Keys →
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold text-white/60">STEP 3</p>
                    <p className="mt-1 font-semibold">Confirm setup</p>
                    <Link href="/quick-start" className="mt-2 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                      View Quick Start →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  The YieldCraft principle
                </p>
                <p className="mt-3 text-sm text-white/70">
                  The people who win long-term don’t try to be right every day.
                  They build a system that shows up every day.
                </p>
                <p className="mt-3 text-xs text-white/50">
                  Small inputs. Strict rules. Patient execution.
                </p>

                <div className="mt-6">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                  >
                    ← Back to homepage
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">What this dashboard will become</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li>• Connection checks (clear green lights)</li>
              <li>• Read-only live heartbeat + last tick timestamp</li>
              <li>• Trade log viewer + daily rollups</li>
              <li>• Risk settings with safe defaults</li>
            </ul>
            <p className="mt-4 text-xs text-white/45">
              We’re building this in a way that protects stability: website first, execution isolated.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-[11px] text-white/45">
          YieldCraft is a software system. Trading involves risk, including possible loss of capital.
        </div>
      </footer>
    </main>
  );
}
