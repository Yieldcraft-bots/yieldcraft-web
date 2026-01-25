// src/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Conn = "ok" | "no" | "checking" | "warn";

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

type BalancesOk = {
  ok: true;
  exchange: "coinbase";
  available_usd: number | null;
  btc_balance: number | null;
  btc_price_usd: number | null;
  equity_usd: number | null;
  last_checked_at?: string | null;
  updated_at?: string | null;
};

type BalancesErr = {
  ok: false;
  error: string;
  status?: number;
  details?: any;
};

type BalancesResp = BalancesOk | BalancesErr;

type Traffic = "green" | "yellow" | "red" | "unknown";

function truthy(v: any) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function normEmail(v: any): string {
  return (typeof v === "string" ? v : "").trim().toLowerCase();
}

function fmtMoney(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtNum(n: number | null | undefined, digits = 8) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function DashboardPage() {
  const router = useRouter();
  const mountedRef = useRef(true);

  // Auto-refresh safety
  const AUTO_REFRESH_MS = 60_000;
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);

  const [accountConn, setAccountConn] = useState<Conn>("checking");
  const [healthConn, setHealthConn] = useState<Conn>("checking");

  const [planConn, setPlanConn] = useState<Conn>("checking");
  const [entitlements, setEntitlements] = useState<Entitlements>({
    pulse: false,
    recon: false,
    atlas: false,
    created_at: null,
  });

  const [platformEngineConn, setPlatformEngineConn] = useState<Conn>("checking");
  const [platformEngineMeta, setPlatformEngineMeta] = useState<{
    authOk: boolean;
    authStatus?: number;
    mode?: string;
  }>({ authOk: false });

  // ✅ multi-user (server-verified)
  const [userCoinbaseConn, setUserCoinbaseConn] = useState<Conn>("checking");
  const [userCoinbaseMeta, setUserCoinbaseMeta] = useState<{ alg?: string }>({});

  // ✅ Balances (read-only)
  const [balancesConn, setBalancesConn] = useState<Conn>("checking");
  const [balances, setBalances] = useState<BalancesResp | null>(null);

  // ✅ Trading status pill (now supports YELLOW for locked)
  const [tradeConn, setTradeConn] = useState<Conn>("checking");
  const [tradeGates, setTradeGates] = useState<TradeGates>({
    COINBASE_TRADING_ENABLED: false,
    PULSE_TRADE_ARMED: false,
    LIVE_ALLOWED: false,
  });

  // ✅ Explain payload (used for click + title)
  const [tradeExplain, setTradeExplain] = useState<{
    traffic: Traffic;
    blocking: string[];
    next_steps: string[];
    rawStatus?: string;
  }>({ traffic: "unknown", blocking: [], next_steps: [] });

  // ✅ store coinbase/status raw so we can show exact reason on click
  const [coinbaseStatusRaw, setCoinbaseStatusRaw] = useState<any>(null);

  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // ✅ UI-only: pill details modal (no trading impact)
  const [pillModal, setPillModal] = useState<{
    open: boolean;
    title: string;
    tone: "green" | "yellow" | "red" | "neutral";
    body: string[];
    footer?: string[];
  }>({ open: false, title: "", tone: "neutral", body: [] });

  const openPillModal = (p: {
    title: string;
    tone: "green" | "yellow" | "red" | "neutral";
    body: string[];
    footer?: string[];
  }) => setPillModal({ open: true, ...p });

  const closePillModal = () =>
    setPillModal({ open: false, title: "", tone: "neutral", body: [] });

  const runCheck = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setChecking(true);
    setAccountConn("checking");
    setHealthConn("checking");
    setPlanConn("checking");
    setPlatformEngineConn("checking");
    setUserCoinbaseConn("checking");
    setBalancesConn("checking");
    setTradeConn("checking");
    setLastCheck(new Date());

    let accessToken: string | null = null;

    try {
      // 1) Auth session (Supabase)
      let sessionUserId: string | null = null;

      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;
        const ok = !!session;

        if (!mountedRef.current) return;

        setAuthed(ok);
        setAccountConn(ok ? "ok" : "no");

        const email = session?.user?.email ?? null;
        const metaEmail =
          (session?.user as any)?.user_metadata?.email ??
          (session?.user as any)?.user_metadata?.preferred_email ??
          null;

        setUserEmail(email as string | null);
        setDisplayEmail((metaEmail ?? email) as string | null);

        if (!ok) {
          setHealthConn("no");
          setPlanConn("no");
          setPlatformEngineConn("no");
          setUserCoinbaseConn("no");
          setBalancesConn("no");
          setTradeConn("no");
          setChecking(false);
          router.replace("/login");
          return;
        }

        accessToken = session?.access_token ?? null;
        sessionUserId = session?.user?.id ?? null;
      } catch {
        if (!mountedRef.current) return;
        setAuthed(false);
        setUserEmail(null);
        setDisplayEmail(null);
        setAccountConn("no");
        setHealthConn("no");
        setPlanConn("no");
        setPlatformEngineConn("no");
        setUserCoinbaseConn("no");
        setBalancesConn("no");
        setTradeConn("no");
        setChecking(false);
        router.replace("/login");
        return;
      }

      // 2) Health probe
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

      // 3) Plan entitlements
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
          setEntitlements({
            pulse: false,
            recon: false,
            atlas: false,
            created_at: null,
          });
          setPlanConn("no");
        }
      } catch {
        if (!mountedRef.current) return;
        setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
        setPlanConn("no");
      }

      // 4) PLATFORM ENGINE keys probe (server env Coinbase auth)
      try {
        const r = await fetch("/api/pulse-heartbeat", { cache: "no-store" });

        let j: ExchangeProbe | null = null;
        try {
          j = (await r.json()) as ExchangeProbe;
        } catch {
          j = null;
        }

        const authOk = !!(
          j?.coinbase_auth?.ok === true &&
          (j?.coinbase_auth?.status ?? 0) >= 200
        );
        const ok = !!(r.ok && j && j.ok === true && authOk);

        if (!mountedRef.current) return;

        setPlatformEngineMeta({
          authOk,
          authStatus: j?.coinbase_auth?.status ?? j?.status,
          mode: j?.mode,
        });

        setPlatformEngineConn(ok ? "ok" : "no");
      } catch {
        if (!mountedRef.current) return;
        setPlatformEngineConn("no");
        setPlatformEngineMeta({ authOk: false });
      }

      // ✅ 5) USER Coinbase status (multi-user, server-verified)
      let userKeysOk = false;
      let userAlg: string | undefined = undefined;

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/coinbase/status", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: any = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        setCoinbaseStatusRaw(j);

        userKeysOk = !!(r.ok && j && j.connected === true);
        userAlg = j?.alg;

        if (!mountedRef.current) return;

        setUserCoinbaseConn(userKeysOk ? "ok" : "no");
        setUserCoinbaseMeta({ alg: userAlg });
      } catch {
        if (!mountedRef.current) return;
        setCoinbaseStatusRaw({ connected: false, error: "network_error" });
        setUserCoinbaseConn("no");
        setUserCoinbaseMeta({});
        userKeysOk = false;
      }

      // ✅ 5b) USER Balances (read-only, server-verified)
      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/coinbase/balances", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: any = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        if (!mountedRef.current) return;

        if (r.ok && j && j.ok === true) {
          setBalancesConn("ok");
          setBalances(j as BalancesOk);
        } else {
          setBalancesConn("no");
          setBalances({
            ok: false,
            error: j?.error || "balances_failed",
            status: j?.status || r.status,
            details: j?.details,
          } as BalancesErr);
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        setBalancesConn("no");
        setBalances({
          ok: false,
          error: e?.message || "balances_failed",
        } as BalancesErr);
      }

      // ✅ 6) Trading gates (USER-SCOPED; now shows YELLOW when locked)
      try {
        if (!sessionUserId) throw new Error("missing_user_id");
        if (!accessToken) throw new Error("missing_access_token"); // ✅ FIX: required for /api/pulse-trade (401 without it)

        const r = await fetch("/api/pulse-trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`, // ✅ FIX: add auth header
          },
          cache: "no-store",
          body: JSON.stringify({ action: "status", user_id: sessionUserId }),
        });

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

        const ok = !!(r.ok && j && j.ok === true);

        // Build explain payload
        const blocking: string[] = [];
        const next_steps: string[] = [];

        let traffic: Traffic = "unknown";
        let connState: Conn = "checking";

        if (!ok) {
          // Broken status endpoint = RED
          blocking.push(`Status check failed (HTTP ${r.status}).`);
          next_steps.push("Refresh and try again. If it persists, reconnect Coinbase keys.");
          traffic = "red";
          connState = "no";
        } else {
          // Status endpoint OK — now interpret gates safely
          // IMPORTANT: use the *fresh* result (userKeysOk), not stale React state
          if (!userKeysOk) {
            blocking.push("No Coinbase keys found for your account.");
            next_steps.push("Click “Connect Keys” and finish the Coinbase connection.");
            traffic = "red";
            connState = "no";
          } else if (!parsed.COINBASE_TRADING_ENABLED) {
            blocking.push("Trading is disabled by platform admin.");
            next_steps.push("Admin must enable COINBASE_TRADING_ENABLED=true in Production env and redeploy.");
            traffic = "red";
            connState = "no";
          } else if (!parsed.PULSE_TRADE_ARMED || !parsed.LIVE_ALLOWED) {
            // SAFE LOCKED state = YELLOW (not an error)
            if (!parsed.PULSE_TRADE_ARMED) {
              blocking.push("Pulse is not armed (safe mode).");
              next_steps.push("Admin must set PULSE_TRADE_ARMED=true in Production env and redeploy.");
            }
            if (!parsed.LIVE_ALLOWED) {
              blocking.push("Live trading is not allowed by current safety gates.");
              next_steps.push("Admin must enable required env flags, then re-check status.");
            }
            traffic = "yellow";
            connState = "warn";
          } else {
            traffic = "green";
            connState = "ok";
          }
        }

        setTradeConn(connState);
        setTradeExplain({
          traffic,
          blocking,
          next_steps,
          rawStatus: j?.status,
        });
      } catch {
        if (!mountedRef.current) return;
        setTradeConn("no");
        setTradeExplain({
          traffic: "red",
          blocking: ["Unable to fetch trading status."],
          next_steps: ["Refresh and try again. If it persists, contact support."],
        });
      }

      if (!mountedRef.current) return;
      setChecking(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    runCheck();
    return () => {
      mountedRef.current = false;
    };
  }, [runCheck]);

  // ✅ Auto-refresh every 60s (paused when tab hidden)
  useEffect(() => {
    const clear = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const start = () => {
      clear();
      if (document.visibilityState !== "visible") return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") runCheck();
      }, AUTO_REFRESH_MS);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else clear();
    };

    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
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

  const isAdmin = useMemo(() => {
    const target = "dk@dwklein.com";
    return normEmail(userEmail) === target || normEmail(displayEmail) === target;
  }, [userEmail, displayEmail]);

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-300">Checking session…</div>
      </main>
    );
  }

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
    if (state === "warn") {
      return {
        wrap: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30",
        dot: "bg-amber-400",
        label: "YELLOW",
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
  const platP = pill(platformEngineConn);
  const userKeysP = pill(userCoinbaseConn);
  const balP = pill(balancesConn);
  const tradeP = pill(tradeConn);

  // Sidebar label: locked should be YELLOW, not GREEN
  const armedLabel = tradeGates.LIVE_ALLOWED
    ? {
        title: "HOT (Live Allowed)",
        tone: "text-rose-200",
        badge: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/25",
      }
    : {
        title: "LOCKED (Safe)",
        tone: "text-amber-200",
        badge: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25",
      };

  const planText =
    planConn === "ok"
      ? `Pulse: ${entitlements.pulse ? "ON" : "OFF"} · Recon: ${entitlements.recon ? "ON" : "OFF"} · Atlas: ${
          entitlements.atlas ? "ON" : "OFF"
        }`
      : "Unable to read plan entitlements (check login / RLS / API).";

  const shownEmail = displayEmail ?? userEmail ?? null;

  const balancesBox = (() => {
    if (userCoinbaseConn !== "ok") {
      return (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
          <p className="font-semibold text-slate-100">Coinbase Balances</p>
          <p className="mt-1 text-slate-400">Connect keys to view balances.</p>
        </div>
      );
    }

    if (balancesConn !== "ok" || !balances || (balances as any).ok !== true) {
      const msg =
        (balances as any)?.error ||
        (balances as any)?.details ||
        "Unable to fetch balances (check Coinbase key permissions).";

      return (
        <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-rose-100">
          <p className="font-semibold">Coinbase Balances</p>
          <p className="mt-1 opacity-90">{String(msg)}</p>
          <p className="mt-2 text-rose-200/80">
            Common cause: API key missing required scopes (View/Trade) or wrong portfolio.
          </p>
        </div>
      );
    }

    const ok = balances as BalancesOk;

    return (
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-100">Coinbase Balances</p>
          <button
            type="button"
            onClick={() => {
              openPillModal({
                title: "BALANCES",
                tone: balancesConn === "ok" ? "green" : "red",
                body: [
                  `Available USD: ${fmtMoney(ok.available_usd)}`,
                  `BTC Balance: ${fmtNum(ok.btc_balance, 8)}`,
                  `BTC Price: ${fmtMoney(ok.btc_price_usd)}`,
                  `Equity (USD): ${fmtMoney(ok.equity_usd)}`,
                  `Last check: ${ok.last_checked_at ?? ok.updated_at ?? "—"}`,
                ],
                footer: ["Balances are read-only and server-verified."],
              });
            }}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
              balP.wrap,
            ].join(" ")}
            title="Click for details"
          >
            <span className={["h-2 w-2 rounded-full", balP.dot].join(" ")} />
            BALANCES: {balP.label}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Available USD</span>
            <span className="font-mono text-slate-100">{fmtMoney(ok.available_usd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">BTC Balance</span>
            <span className="font-mono text-slate-100">{fmtNum(ok.btc_balance, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">BTC Price</span>
            <span className="font-mono text-slate-100">{fmtMoney(ok.btc_price_usd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Equity (USD)</span>
            <span className="font-mono text-slate-100">{fmtMoney(ok.equity_usd)}</span>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Last check: <span className="text-slate-300">{ok.last_checked_at ?? ok.updated_at ?? "—"}</span>
            <span className="ml-2 text-slate-600">· Auto-refresh: 60s</span>
          </p>
        </div>
      </div>
    );
  })();

  const coinbaseClickMsg = () => {
    if (userCoinbaseConn === "ok")
      return `✅ Coinbase connected.\nAlg: ${userCoinbaseMeta.alg ?? "unknown"}`;

    const r = coinbaseStatusRaw || {};
    const reason = r?.reason || r?.error || "unknown";
    if (reason === "no_keys") return "❌ No keys saved yet.\n\nNext: Go to Connect Keys and click Verify & Continue.";
    if (reason === "invalid_keys") return "❌ Keys saved but invalid.\n\nNext: Re-paste using Coinbase copy icons (don’t drag-select).";
    if (reason === "not_authenticated") return "❌ Not signed in.\n\nNext: Log out and back in, then re-check.";
    return `❌ Coinbase not connected.\nReason: ${reason}\n\nNext: Go to Connect Keys and click Verify & Continue.`;
  };

  const tradingClickMsg = () => {
    if (tradeExplain.traffic === "green") return "✅ Trading status verified (per-user).";
    if (tradeExplain.traffic === "yellow") return "🟡 Trading is locked (safe mode). Not an error.";
    const blocks = tradeExplain.blocking.length ? `\n\nBlocking:\n• ${tradeExplain.blocking.join("\n• ")}` : "";
    const steps = tradeExplain.next_steps.length ? `\n\nNext:\n• ${tradeExplain.next_steps.join("\n• ")}` : "";
    return `⚠️ Trading is not green.${blocks}${steps}`;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* ✅ Pill Details Modal (UI-only) */}
      {pillModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          onClick={closePillModal}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status details</p>
                <h2 className="mt-1 text-xl font-bold text-slate-100">{pillModal.title}</h2>

                <div className="mt-2">
                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ring-1",
                      pillModal.tone === "green"
                        ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
                        : pillModal.tone === "yellow"
                        ? "bg-amber-500/15 text-amber-200 ring-amber-500/25"
                        : pillModal.tone === "red"
                        ? "bg-rose-500/15 text-rose-200 ring-rose-500/25"
                        : "bg-slate-800/60 text-slate-200 ring-slate-700",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        pillModal.tone === "green"
                          ? "bg-emerald-400"
                          : pillModal.tone === "yellow"
                          ? "bg-amber-400"
                          : pillModal.tone === "red"
                          ? "bg-rose-400"
                          : "bg-slate-300",
                      ].join(" ")}
                    />
                    {pillModal.tone === "green"
                      ? "GREEN"
                      : pillModal.tone === "yellow"
                      ? "YELLOW"
                      : pillModal.tone === "red"
                      ? "RED"
                      : "INFO"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={closePillModal}
                className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/70"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-200">
              {pillModal.body.map((line, idx) => (
                <p key={idx} className="text-slate-200">
                  {line}
                </p>
              ))}
            </div>

            {pillModal.footer?.length ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/35 p-4 text-xs text-slate-400">
                {pillModal.footer.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                Dashboard · Control Panel (Read-Only)
              </span>

              <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", accP.wrap].join(" ")}>
                <span className={["h-2 w-2 rounded-full", accP.dot].join(" ")} />
                SIGNED IN: {accP.label}
              </span>

              <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", healthP.wrap].join(" ")}>
                <span className={["h-2 w-2 rounded-full", healthP.dot].join(" ")} />
                HEALTH: {healthP.label}
              </span>

              <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", planP.wrap].join(" ")}>
                <span className={["h-2 w-2 rounded-full", planP.dot].join(" ")} />
                PLAN ACCESS: {planP.label}
              </span>

              {/* ✅ Clickable Coinbase pill */}
              <button
                type="button"
                onClick={() => {
                  const msg = coinbaseClickMsg();
                  const lines = msg.split("\n").map((s) => s.trim()).filter(Boolean);

                  openPillModal({
                    title: "YOUR COINBASE",
                    tone: userCoinbaseConn === "ok" ? "green" : "red",
                    body: lines,
                    footer: ["This is your personal connection status (server-verified)."],
                  });
                }}
                className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", userKeysP.wrap].join(" ")}
                title="Click for details"
              >
                <span className={["h-2 w-2 rounded-full", userKeysP.dot].join(" ")} />
                YOUR COINBASE: {userKeysP.label}
              </button>

              {/* ✅ BALANCES pill (clickable) */}
              <button
                type="button"
                onClick={() => {
                  if (balancesConn !== "ok" || !balances || (balances as any).ok !== true) {
                    const msg =
                      (balances as any)?.error ||
                      (balances as any)?.details ||
                      "Unable to fetch balances (check Coinbase key permissions).";

                    openPillModal({
                      title: "BALANCES",
                      tone: "red",
                      body: [String(msg), "Common cause: API key missing required scopes (View/Trade) or wrong portfolio."],
                      footer: ["Balances are read-only and server-verified."],
                    });
                    return;
                  }

                  const ok = balances as BalancesOk;

                  openPillModal({
                    title: "BALANCES",
                    tone: "green",
                    body: [
                      `Available USD: ${fmtMoney(ok.available_usd)}`,
                      `BTC Balance: ${fmtNum(ok.btc_balance, 8)}`,
                      `BTC Price: ${fmtMoney(ok.btc_price_usd)}`,
                      `Equity (USD): ${fmtMoney(ok.equity_usd)}`,
                      `Last check: ${ok.last_checked_at ?? ok.updated_at ?? "—"}`,
                    ],
                    footer: ["Balances are read-only and server-verified."],
                  });
                }}
                className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", balP.wrap].join(" ")}
                title="Click for details"
              >
                <span className={["h-2 w-2 rounded-full", balP.dot].join(" ")} />
                BALANCES: {balP.label}
              </button>

              {/* ✅ PLATFORM ENGINE pill (clickable) */}
              <button
                type="button"
                onClick={() => {
                  const ok = platformEngineConn === "ok" && platformEngineMeta.authOk;
                  openPillModal({
                    title: "PLATFORM ENGINE",
                    tone: ok ? "green" : "red",
                    body: [
                      ok ? "✅ Platform engine can authenticate to Coinbase (server env keys)." : "❌ Platform engine auth is failing.",
                      `Auth status: ${platformEngineMeta.authStatus ?? "—"}`,
                      `Mode: ${platformEngineMeta.mode ?? "—"}`,
                    ],
                    footer: ["This is the platform’s server connectivity (not your personal keys)."],
                  });
                }}
                className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", platP.wrap].join(" ")}
                title="Click for details"
              >
                <span className={["h-2 w-2 rounded-full", platP.dot].join(" ")} />
                PLATFORM ENGINE: {platP.label}
              </button>

              {/* ✅ Clickable Trading Status pill */}
              <button
                type="button"
                onClick={() => {
                  const msg = tradingClickMsg();
                  const lines = msg.split("\n").map((s) => s.trim()).filter(Boolean);

                  openPillModal({
                    title: "TRADING STATUS",
                    tone:
                      tradeExplain.traffic === "green"
                        ? "green"
                        : tradeExplain.traffic === "yellow"
                        ? "yellow"
                        : "red",
                    body: lines,
                    footer: ["This is per-user Pulse status (server-verified)."],
                  });
                }}
                className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", tradeP.wrap].join(" ")}
                title={
                  tradeExplain.traffic === "green"
                    ? "Trading status verified (per-user)."
                    : tradeExplain.traffic === "yellow"
                    ? "Trading is locked (safe mode)."
                    : tradeExplain.blocking.length
                    ? `${tradeExplain.blocking.join(" ")} ${tradeExplain.next_steps.length ? "Next: " + tradeExplain.next_steps.join(" ") : ""}`
                    : "Trading status unavailable."
                }
              >
                <span className={["h-2 w-2 rounded-full", tradeP.dot].join(" ")} />
                TRADING STATUS: {tradeP.label}
              </button>

              <span className="text-xs text-slate-400">
                Last check: <span className="text-slate-200">{lastCheck ? fmt(lastCheck) : "—"}</span>
                <span className="ml-2 text-slate-600">· Auto-refresh: 60s</span>
              </span>

              <button
                type="button"
                onClick={runCheck}
                className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/70"
              >
                Re-check
              </button>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15"
                >
                  Admin Mission Control →
                </Link>
              )}
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

                {balancesBox}

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">Important</p>
                  <p className="mt-1 text-slate-400">
                    “PLATFORM ENGINE” = server connectivity (us).<br />
                    “YOUR COINBASE” = your personal setup completion (server-verified).<br />
                    “BALANCES” = read-only account snapshot (server-verified).<br />
                    “TRADING STATUS” = per-user pulse-trade status (server-verified).
                  </p>
                </div>

                {shownEmail ? (
                  <p className="mt-4 text-[11px] text-slate-500">
                    Signed in as: <span className="text-slate-200">{shownEmail}</span>
                  </p>
                ) : null}
              </aside>
            </div>
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
