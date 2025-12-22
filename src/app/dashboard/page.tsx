// src/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ✅ IMPORTANT: match the filename exactly
import { supabase } from "../../lib/supabaseClient";

type Conn = "ok" | "no" | "checking";

type TradeGates = {
  COINBASE_TRADING_ENABLED: boolean;
  PULSE_TRADE_ARMED: boolean;
  LIVE_ALLOWED: boolean;
};

type ExchangeProbe = {
  ok?: boolean;
  status?: number;
  mode?: string;
  coinbase_auth?: {
    ok?: boolean;
    status?: number;
    auth?: string;
  };
};

type Entitlements = {
  pulse: boolean;
  recon: boolean;
  atlas: boolean;
  created_at?: string | null;
};

function truthy(v: any) {
  return v === true || v === "true" || v === 1 || v === "1";
}

export default function DashboardPage() {
  const router = useRouter();
  const mountedRef = useRef(true);

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  // Real meanings:
  // - accountConn: SIGNED IN status (auth/session)
  // - healthConn: read-only /api/health probe (site/backend reachable)
  const [accountConn, setAccountConn] = useState<Conn>("checking");
  const [healthConn, setHealthConn] = useState<Conn>("checking");

  // NEW: Plan entitlements (read-only via /api/entitlements using Bearer token)
  const [planConn, setPlanConn] = useState<Conn>("checking");
  const [entitlements, setEntitlements] = useState<Entitlements>({
    pulse: false,
    recon: false,
    atlas: false,
    created_at: null,
  });

  // NEW: Exchange keys (read-only probe via /api/pulse-heartbeat)
  const [exchangeConn, setExchangeConn] = useState<Conn>("checking");
  const [exchangeMeta, setExchangeMeta] = useState<{
    authOk: boolean;
    authStatus?: number;
    mode?: string;
  }>({ authOk: false });

  // Trading status (read-only from /api/pulse-trade GET)
  const [tradeConn, setTradeConn] = useState<Conn>("checking");
  const [tradeGates, setTradeGates] = useState<TradeGates>({
    COINBASE_TRADING_ENABLED: false,
    PULSE_TRADE_ARMED: false,
    LIVE_ALLOWED: false,
  });

  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setAccountConn("checking");
    setHealthConn("checking");
    setPlanConn("checking");
    setExchangeConn("checking");
    setTradeConn("checking");
    setLastCheck(new Date());

    let accessToken: string | null = null;

    // 1) Check auth session (Supabase)
    try {
      const { data } = await supabase.auth.getSession();
      const ok = !!data?.session;

      if (!mountedRef.current) return;

      setAuthed(ok);
      setAccountConn(ok ? "ok" : "no");

      if (!ok) {
        setHealthConn("no");
        setPlanConn("no");
        setExchangeConn("no");
        setTradeConn("no");
        setChecking(false);
        router.replace("/login");
        return;
      }

      accessToken = data?.session?.access_token ?? null;
    } catch {
      if (!mountedRef.current) return;
      setAuthed(false);
      setAccountConn("no");
      setHealthConn("no");
      setPlanConn("no");
      setExchangeConn("no");
      setTradeConn("no");
      setChecking(false);
      router.replace("/login");
      return;
    }

    // 2) Read-only health probe (does NOT mean “keys connected”)
    try {
      const res = await fetch("/api/health", { cache: "no-store" });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      const healthy = !!(res.ok && json && json.ok === true);

      if (!mountedRef.current) return;
      setHealthConn(healthy ? "ok" : "no");
    } catch {
      if (!mountedRef.current) return;
      setHealthConn("no");
    }

    // 3) Plan entitlements (Bearer token -> RLS-safe)
    try {
      if (!accessToken) throw new Error("missing_access_token");

      const r = await fetch("/api/entitlements", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      const ok = !!(r.ok && j && j.ok === true && j.entitlements);

      if (!mountedRef.current) return;

      if (ok) {
        setEntitlements({
          pulse: !!j.entitlements.pulse,
          recon: !!j.entitlements.recon,
          atlas: !!j.entitlements.atlas,
          created_at: j.entitlements.created_at ?? null,
        });
        setPlanConn("ok");
      } else {
        setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
        setPlanConn("no");
      }
    } catch {
      if (!mountedRef.current) return;
      setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
      setPlanConn("no");
    }

    // 4) Exchange keys probe (read-only) — verifies Coinbase auth only
    try {
      const r = await fetch("/api/pulse-heartbeat", { cache: "no-store" });

      let j: ExchangeProbe | null = null;
      try {
        j = (await r.json()) as ExchangeProbe;
      } catch {
        j = null;
      }

      const authOk = !!(j?.coinbase_auth?.ok === true && (j?.coinbase_auth?.status ?? 0) >= 200);
      const ok = !!(r.ok && j && j.ok === true && authOk);

      if (!mountedRef.current) return;

      setExchangeMeta({
        authOk,
        authStatus: j?.coinbase_auth?.status ?? j?.status,
        mode: j?.mode,
      });

      // "ok" means: read-only auth verified (not just reachable)
      setExchangeConn(ok ? "ok" : "no");
    } catch {
      if (!mountedRef.current) return;
      setExchangeConn("no");
      setExchangeMeta({ authOk: false });
    }

    // 5) Read-only trading gates (does NOT place orders)
    try {
      const r = await fetch("/api/pulse-trade", { cache: "no-store" });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      const gates = j?.gates || {};
      const parsed: TradeGates = {
        COINBASE_TRADING_ENABLED: truthy(gates.COINBASE_TRADING_ENABLED),
        PULSE_TRADE_ARMED: truthy(gates.PULSE_TRADE_ARMED),
        LIVE_ALLOWED: truthy(gates.LIVE_ALLOWED),
      };

      if (!mountedRef.current) return;

      setTradeGates(parsed);

      // "ok" means we can read the gate state successfully
      // even if LIVE_ALLOWED is false (locked is expected).
      const ok = !!(r.ok && j && j.ok === true);
      setTradeConn(ok ? "ok" : "no");
    } catch {
      if (!mountedRef.current) return;
      setTradeConn("no");
    }

    if (!mountedRef.current) return;
    setChecking(false);
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    runCheck();
    return () => {
      mountedRef.current = false;
    };
  }, [runCheck]);

  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });

  // Simple guard UI
  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-300">Checking session…</div>
      </main>
    );
  }

  // If not authed, we already redirected — this prevents a flash.
  if (!authed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-300">Redirecting to login…</div>
      </main>
    );
  }

  const pill = (state: Conn) => {
    if (state === "checking") {
      return {
        wrap: "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700",
        dot: "bg-slate-300",
        label: "CHECKING",
      };
    }
    if (state === "ok") {
      return {
        wrap: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30",
        dot: "bg-emerald-400",
        label: "GREEN",
      };
    }
    return {
      wrap: "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30",
      dot: "bg-rose-400",
      label: "RED",
    };
  };

  const accP = pill(accountConn);
  const healthP = pill(healthConn);
  const planP = pill(planConn);
  const exP = pill(exchangeConn);
  const tradeP = pill(tradeConn);

  const armedLabel = tradeGates.LIVE_ALLOWED
    ? {
        title: "HOT (Live Allowed)",
        tone: "text-rose-200",
        badge: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/25",
      }
    : {
        title: "LOCKED (Safe)",
        tone: "text-emerald-200",
        badge: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25",
      };

  const planText =
    planConn === "ok"
      ? `Pulse: ${entitlements.pulse ? "ON" : "OFF"} · Recon: ${entitlements.recon ? "ON" : "OFF"} · Atlas: ${
          entitlements.atlas ? "ON" : "OFF"
        }`
      : "Unable to read plan entitlements (check login / RLS / API).";

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

              {/* Signed-in status (real) */}
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  accP.wrap,
                ].join(" ")}
                title="This reflects whether you are signed in (Supabase session)."
              >
                <span className={["h-2 w-2 rounded-full", accP.dot].join(" ")} />
                SIGNED IN: {accP.label}
              </span>

              {/* Health probe (read-only) */}
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  healthP.wrap,
                ].join(" ")}
                title="This is a read-only /api/health probe (site/backend reachable)."
              >
                <span className={["h-2 w-2 rounded-full", healthP.dot].join(" ")} />
                HEALTH: {healthP.label}
              </span>

              {/* Plan entitlements (bearer) */}
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  planP.wrap,
                ].join(" ")}
                title="Read-only entitlement check via /api/entitlements using your session Bearer token."
              >
                <span className={["h-2 w-2 rounded-full", planP.dot].join(" ")} />
                PLAN ACCESS: {planP.label}
              </span>

              {/* Exchange keys (read-only auth verification) */}
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  exP.wrap,
                ].join(" ")}
                title="Read-only Coinbase auth verification via /api/pulse-heartbeat. Does NOT place trades."
              >
                <span className={["h-2 w-2 rounded-full", exP.dot].join(" ")} />
                EXCHANGE KEYS: {exP.label}
              </span>

              {/* Trading status (read-only gates probe) */}
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
                  tradeP.wrap,
                ].join(" ")}
                title="Read-only check of /api/pulse-trade gates. This does NOT place trades."
              >
                <span className={["h-2 w-2 rounded-full", tradeP.dot].join(" ")} />
                TRADING STATUS: {tradeP.label}
              </span>

              <span className="text-xs text-slate-400">
                Last check: <span className="text-slate-200">{lastCheck ? fmt(lastCheck) : "—"}</span>
              </span>

              <button
                type="button"
                onClick={runCheck}
                className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/70"
                title="Re-check (read-only)."
              >
                Re-check
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
              <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Your system hub — <span className="text-sky-300">simple, clear, and safe.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                  Follow the setup path once. After that, the system runs on rules — not emotions.
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

              <aside className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Plan access</p>
                <p className="mt-3 text-sm text-slate-200">{planText}</p>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
                  Trading is <span className={armedLabel.tone}>{armedLabel.title}</span> unless you explicitly arm it.
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Status Grid */}
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
            {/* Account */}
            <div
              className={[
                "rounded-3xl border bg-slate-900/40 p-5",
                accountConn === "ok"
                  ? "border-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
                  : "border-rose-500/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account</p>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    accountConn === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200",
                  ].join(" ")}
                >
                  {accountConn === "ok" ? "GREEN" : "RED"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Signed In</p>
              <p className="mt-1 text-sm text-slate-300">Session verified. You can continue setup.</p>
            </div>

            {/* Engine */}
            <div
              className={[
                "rounded-3xl border bg-slate-900/40 p-5",
                tradeGates.LIVE_ALLOWED
                  ? "border-rose-500/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]"
                  : "border-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Engine</p>
                <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold", armedLabel.badge].join(" ")}>
                  {armedLabel.title}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Armed State</p>
              <p className="mt-1 text-sm text-slate-300">
                {tradeGates.LIVE_ALLOWED
                  ? "Armed (hot). Live execution is allowed if called."
                  : "Locked (safe). Live execution is blocked until explicitly armed."}
              </p>

              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    COINBASE_TRADING_ENABLED:{" "}
                    <span className={tradeGates.COINBASE_TRADING_ENABLED ? "text-emerald-200" : "text-rose-200"}>
                      {tradeGates.COINBASE_TRADING_ENABLED ? "true" : "false"}
                    </span>
                  </span>
                  <span>
                    PULSE_TRADE_ARMED:{" "}
                    <span className={tradeGates.PULSE_TRADE_ARMED ? "text-emerald-200" : "text-rose-200"}>
                      {tradeGates.PULSE_TRADE_ARMED ? "true" : "false"}
                    </span>
                  </span>
                  <span>
                    LIVE_ALLOWED:{" "}
                    <span className={tradeGates.LIVE_ALLOWED ? "text-rose-200" : "text-emerald-200"}>
                      {tradeGates.LIVE_ALLOWED ? "true" : "false"}
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Read-only status from <code className="text-slate-200">/api/pulse-trade</code>. No trades are placed here.
                </p>
              </div>
            </div>

            {/* Health */}
            <div
              className={[
                "rounded-3xl border bg-slate-900/40 p-5",
                healthConn === "ok"
                  ? "border-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
                  : "border-rose-500/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Health</p>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    healthConn === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200",
                  ].join(" ")}
                >
                  {healthConn === "ok" ? "GREEN" : "RED"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">/api/health</p>
              <p className="mt-1 text-sm text-slate-300">
                {healthConn === "ok" ? "Health probe verified (ok:true)." : "Health probe failed or not reachable."}
              </p>
            </div>

            {/* Exchange Keys */}
            <div
              className={[
                "rounded-3xl border bg-slate-900/40 p-5 lg:col-span-3",
                exchangeConn === "ok"
                  ? "border-emerald-500/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
                  : "border-rose-500/25 shadow-[0_0_0_1px_rgba(244,63,94,0.10)]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exchange</p>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    exchangeConn === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200",
                  ].join(" ")}
                >
                  {exchangeConn === "ok" ? "VERIFIED" : "NOT VERIFIED"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">Coinbase Keys (Read-Only)</p>
              <p className="mt-1 text-sm text-slate-300">
                {exchangeConn === "ok"
                  ? "Authentication verified (status 200). Safe mode confirmed."
                  : "Auth probe failed or not reachable. Re-check or review env keys."}
              </p>

              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    auth_ok:{" "}
                    <span className={exchangeMeta.authOk ? "text-emerald-200" : "text-rose-200"}>
                      {exchangeMeta.authOk ? "true" : "false"}
                    </span>
                  </span>
                  <span>
                    status: <span className="text-slate-200">{exchangeMeta.authStatus ?? "—"}</span>
                  </span>
                  <span>
                    mode: <span className="text-slate-200">{exchangeMeta.mode ?? "—"}</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Data comes from <code className="text-slate-200">/api/pulse-heartbeat</code>. This is a read-only verification, not execution.
                </p>
              </div>
            </div>

            {/* Principle */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">The YieldCraft principle</p>
              <p className="mt-3 text-sm text-slate-200">
                Long-term wins come from showing up with a system — not trying to be right every day.
              </p>
              <p className="mt-2 text-xs text-slate-400">Small inputs. Strict rules. Patient execution.</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
                >
                  ← Back to homepage
                </Link>
              </div>
            </div>
          </div>

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

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
          YieldCraft provides software tools for structured workflows. Not investment advice. Trading involves risk,
          including possible loss of capital. No guarantees of performance.
        </div>
      </footer>
    </main>
  );
}
