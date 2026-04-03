"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Conn = "ok" | "no" | "checking" | "warn";
type Traffic = "green" | "yellow" | "red" | "unknown";
type ProductScope = "pulse" | "atlas";

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
  product_scope?: ProductScope;
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
  details?: unknown;
  product_scope?: ProductScope;
};

type BalancesResp = BalancesOk | BalancesErr;

type PnlSnapshotOk = {
  ok: true;
  runId?: string;
  since?: string;
  symbol?: string;
  user_id?: string;
  rows_scanned?: number;
  rows_usable?: number;
  limit?: number;
  total_trades?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  avg_win_bps?: number;
  avg_loss_bps?: number;
  net_realized_pnl_usd?: number;
  current_open_pnl_usd?: number;
  open_position_base?: number;
  open_cost_usd?: number;
  spot_price?: number | null;
  open_avg_price?: number | null;
  starting_equity_usd?: number;
  running_equity_usd?: number;
  max_drawdown_pct?: number;
  debug?: unknown;
};

type PnlSnapshotErr = {
  ok: false;
  runId?: string;
  error: string;
};

type PnlSnapshotResp = PnlSnapshotOk | PnlSnapshotErr;

type PillTone = "green" | "yellow" | "red" | "neutral";

type PillModalState = {
  open: boolean;
  title: string;
  tone: PillTone;
  body: string[];
  footer?: string[];
};

function truthy(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function normEmail(v: unknown): string {
  return (typeof v === "string" ? v : "").trim().toLowerCase();
}

function fmtMoney(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtSignedMoney(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtNum(n: number | null | undefined, digits = 8) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtPct(n: number | null | undefined, digits = 2) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function fmtBps(n: number | null | undefined, digits = 2) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)} bps`;
}

function safeCount(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function getConnPill(state: Conn) {
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
}

function pnlPerfStateFromSnapshot(pnlSnapshot: PnlSnapshotResp | null, pnlConn: Conn): Conn {
  if (!pnlSnapshot || pnlSnapshot.ok !== true) return pnlConn;

  const realized = pnlSnapshot.net_realized_pnl_usd ?? 0;

  if (realized > 0) return "ok";
  if (realized < -1) return "no";
  if (realized < 0) return "warn";
  return "warn";
}

function StatusButton({
  label,
  pill,
  onClick,
  title,
}: {
  label: string;
  pill: ReturnType<typeof getConnPill>;
  onClick?: () => void;
  title?: string;
}) {
  const className = [
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
    pill.wrap,
  ].join(" ");

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title={title}>
        <span className={["h-2 w-2 rounded-full", pill.dot].join(" ")} />
        {label}: {pill.label}
      </button>
    );
  }

  return (
    <span className={className} title={title}>
      <span className={["h-2 w-2 rounded-full", pill.dot].join(" ")} />
      {label}: {pill.label}
    </span>
  );
}

function BalanceCard({
  title,
  scopeLabel,
  conn,
  balances,
  tone = "slate",
  onOpenDetails,
  emptyMessage,
  subtitle,
}: {
  title: string;
  scopeLabel: string;
  conn: Conn;
  balances: BalancesResp | null;
  tone?: "slate" | "indigo";
  onOpenDetails: () => void;
  emptyMessage: string;
  subtitle?: string;
}) {
  const p = getConnPill(conn);

  const boxClass =
    tone === "indigo"
      ? "mt-4 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-xs text-indigo-100"
      : "mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300";

  const labelClass = tone === "indigo" ? "text-indigo-200/80" : "text-slate-400";
  const valueClass = tone === "indigo" ? "font-mono text-indigo-50" : "font-mono text-slate-100";
  const footClass = tone === "indigo" ? "text-indigo-200/70" : "text-slate-500";

  if (conn !== "ok" || !balances || balances.ok !== true) {
    const msg =
      balances && balances.ok === false ? String(balances.error || emptyMessage) : emptyMessage;

    return (
      <div className={boxClass}>
        <div className="flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button
            type="button"
            onClick={onOpenDetails}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
              p.wrap,
            ].join(" ")}
            title="Click for details"
          >
            <span className={["h-2 w-2 rounded-full", p.dot].join(" ")} />
            {scopeLabel}: {p.label}
          </button>
        </div>

        <p className="mt-1 opacity-90">{msg}</p>
        {subtitle ? <p className="mt-2 opacity-80">{subtitle}</p> : null}
      </div>
    );
  }

  const ok = balances;

  return (
    <div className={boxClass}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <button
          type="button"
          onClick={onOpenDetails}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
            p.wrap,
          ].join(" ")}
          title="Click for details"
        >
          <span className={["h-2 w-2 rounded-full", p.dot].join(" ")} />
          {scopeLabel}: {p.label}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex justify-between">
          <span className={labelClass}>Available USD</span>
          <span className={valueClass}>{fmtMoney(ok.available_usd)}</span>
        </div>
        <div className="flex justify-between">
          <span className={labelClass}>BTC Balance</span>
          <span className={valueClass}>{fmtNum(ok.btc_balance, 8)}</span>
        </div>
        <div className="flex justify-between">
          <span className={labelClass}>BTC Price</span>
          <span className={valueClass}>{fmtMoney(ok.btc_price_usd)}</span>
        </div>
        <div className="flex justify-between">
          <span className={labelClass}>Equity (USD)</span>
          <span className={valueClass}>{fmtMoney(ok.equity_usd)}</span>
        </div>

        <p className={`mt-2 text-[11px] ${footClass}`}>
          Last check:{" "}
          <span className={tone === "indigo" ? "text-indigo-50" : "text-slate-300"}>
            {ok.last_checked_at ?? ok.updated_at ?? "—"}
          </span>
          <span className={tone === "indigo" ? "ml-2 text-indigo-200/50" : "ml-2 text-slate-600"}>
            · Auto-refresh: 60s
          </span>
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
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

  const [userCoinbaseConn, setUserCoinbaseConn] = useState<Conn>("checking");
  const [userCoinbaseMeta, setUserCoinbaseMeta] = useState<{ alg?: string }>({});
  const [coinbaseStatusRaw, setCoinbaseStatusRaw] = useState<unknown>(null);

  const [balancesConn, setBalancesConn] = useState<Conn>("checking");
  const [balances, setBalances] = useState<BalancesResp | null>(null);

  const [atlasBalancesConn, setAtlasBalancesConn] = useState<Conn>("checking");
  const [atlasBalances, setAtlasBalances] = useState<BalancesResp | null>(null);

  const [tradeConn, setTradeConn] = useState<Conn>("checking");
  const [tradeGates, setTradeGates] = useState<TradeGates>({
    COINBASE_TRADING_ENABLED: false,
    PULSE_TRADE_ARMED: false,
    LIVE_ALLOWED: false,
  });

  const [tradeExplain, setTradeExplain] = useState<{
    traffic: Traffic;
    blocking: string[];
    next_steps: string[];
    rawStatus?: string;
  }>({ traffic: "unknown", blocking: [], next_steps: [] });

  const [pnlConn, setPnlConn] = useState<Conn>("checking");
  const [pnlSnapshot, setPnlSnapshot] = useState<PnlSnapshotResp | null>(null);

  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const [pillModal, setPillModal] = useState<PillModalState>({
    open: false,
    title: "",
    tone: "neutral",
    body: [],
  });

  const openPillModal = (p: Omit<PillModalState, "open">) => {
    setPillModal({ open: true, ...p });
  };

  const closePillModal = () => {
    setPillModal({ open: false, title: "", tone: "neutral", body: [] });
  };

  const fmt = useCallback((d: Date) => {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const isAdmin = useMemo(() => {
    const target = "dk@dwklein.com";
    return normEmail(userEmail) === target || normEmail(displayEmail) === target;
  }, [userEmail, displayEmail]);

  const openBalanceModal = useCallback(
    (title: string, conn: Conn, data: BalancesResp | null, footer: string[]) => {
      if (conn !== "ok" || !data || data.ok !== true) {
        const msg = data && data.ok === false ? String(data.error || "Unable to fetch balances.") : "Unable to fetch balances.";

        openPillModal({
          title,
          tone: "red",
          body: [msg],
          footer,
        });
        return;
      }

      openPillModal({
        title,
        tone: "green",
        body: [
          `Available USD: ${fmtMoney(data.available_usd)}`,
          `BTC Balance: ${fmtNum(data.btc_balance, 8)}`,
          `BTC Price: ${fmtMoney(data.btc_price_usd)}`,
          `Equity (USD): ${fmtMoney(data.equity_usd)}`,
          `Last check: ${data.last_checked_at ?? data.updated_at ?? "—"}`,
        ],
        footer,
      });
    },
    []
  );

  const coinbaseClickMsg = useCallback(() => {
    if (userCoinbaseConn === "ok") {
      return `✅ Pulse Coinbase connected.\nAlg: ${userCoinbaseMeta.alg ?? "unknown"}`;
    }

    const r = (coinbaseStatusRaw ?? {}) as Record<string, unknown>;
    const reason = String(r?.reason ?? r?.error ?? "unknown");

    if (reason === "no_keys") {
      return "❌ No Pulse keys saved yet.\n\nNext: Go to Connect Pulse Keys and complete the flow.";
    }

    if (reason === "invalid_keys") {
      return "❌ Pulse keys are saved but invalid.\n\nNext: Re-paste using Coinbase copy icons and verify again.";
    }

    if (reason === "not_authenticated") {
      return "❌ Not signed in.\n\nNext: Log out and back in, then re-check.";
    }

    return `❌ Pulse Coinbase not connected.\nReason: ${reason}\n\nNext: Go to Connect Pulse Keys and verify again.`;
  }, [coinbaseStatusRaw, userCoinbaseConn, userCoinbaseMeta.alg]);

  const tradingClickMsg = useCallback(() => {
    if (tradeExplain.traffic === "green") return "✅ Trading status verified (per-user).";
    if (tradeExplain.traffic === "yellow") return "🟡 Trading is locked in safe mode. This is not a failure.";

    const blocks = tradeExplain.blocking.length
      ? `\n\nBlocking:\n• ${tradeExplain.blocking.join("\n• ")}`
      : "";

    const steps = tradeExplain.next_steps.length
      ? `\n\nNext:\n• ${tradeExplain.next_steps.join("\n• ")}`
      : "";

    return `⚠️ Trading is not green.${blocks}${steps}`;
  }, [tradeExplain]);

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
    setAtlasBalancesConn("checking");
    setTradeConn("checking");
    setPnlConn("checking");
    setLastCheck(new Date());

    let accessToken: string | null = null;

    try {
      let sessionUserId: string | null = null;

      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;
        const ok = !!session;

        if (!mountedRef.current) return;

        setAuthed(ok);
        setAccountConn(ok ? "ok" : "no");

        const email = session?.user?.email ?? null;
        const meta = (session?.user as { user_metadata?: Record<string, unknown> } | null)?.user_metadata;
        const metaEmail =
          (typeof meta?.email === "string" ? meta.email : null) ??
          (typeof meta?.preferred_email === "string" ? meta.preferred_email : null);

        setUserEmail(email);
        setDisplayEmail(metaEmail ?? email);

        if (!ok) {
          setHealthConn("no");
          setPlanConn("no");
          setPlatformEngineConn("no");
          setUserCoinbaseConn("no");
          setBalancesConn("no");
          setAtlasBalancesConn("no");
          setTradeConn("no");
          setPnlConn("no");
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
        setAtlasBalancesConn("no");
        setTradeConn("no");
        setPnlConn("no");
        setChecking(false);
        router.replace("/login");
        return;
      }

      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        let json: unknown = null;

        try {
          json = await res.json();
        } catch {
          json = null;
        }

        const healthy = !!(res.ok && typeof json === "object" && json && (json as { ok?: boolean }).ok === true);

        if (!mountedRef.current) return;
        setHealthConn(healthy ? "ok" : "no");
      } catch {
        if (!mountedRef.current) return;
        setHealthConn("no");
      }

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/entitlements", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        const ok =
          !!r.ok &&
          typeof j === "object" &&
          j !== null &&
          (j as { ok?: boolean; entitlements?: unknown }).ok === true &&
          !!(j as { entitlements?: unknown }).entitlements;

        if (!mountedRef.current) return;

        if (ok) {
          const ent = (j as { entitlements: Partial<Entitlements> }).entitlements;
          setEntitlements({
            pulse: !!ent.pulse,
            recon: !!ent.recon,
            atlas: !!ent.atlas,
            created_at: ent.created_at ?? null,
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

      try {
        const r = await fetch("/api/pulse-heartbeat", { cache: "no-store" });

        let j: ExchangeProbe | null = null;
        try {
          j = (await r.json()) as ExchangeProbe;
        } catch {
          j = null;
        }

        const authOk = !!(j?.coinbase_auth?.ok === true && (j?.coinbase_auth?.status ?? 0) >= 200);
        const ok = !!(r.ok && j?.ok === true && authOk);

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

      let userKeysOk = false;
      let userAlg: string | undefined;

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/coinbase/status?product=pulse", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        setCoinbaseStatusRaw(j);

        const jr = (j ?? {}) as { connected?: boolean; alg?: string };
        userKeysOk = !!(r.ok && jr.connected === true);
        userAlg = jr.alg;

        if (!mountedRef.current) return;

        setUserCoinbaseConn(userKeysOk ? "ok" : "no");
        setUserCoinbaseMeta({ alg: userAlg });
      } catch {
        if (!mountedRef.current) return;
        setCoinbaseStatusRaw({ connected: false, error: "network_error" });
        setUserCoinbaseConn("no");
        setUserCoinbaseMeta({});
      }

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/coinbase/balances?product=pulse", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        if (!mountedRef.current) return;

        const parsed = j as Partial<BalancesOk & BalancesErr>;

        if (r.ok && parsed && parsed.ok === true) {
          setBalancesConn("ok");
          setBalances(parsed as BalancesOk);
        } else {
          setBalancesConn("no");
          setBalances({
            ok: false,
            error: String(parsed?.error ?? "balances_failed"),
            status: parsed?.status ?? r.status,
            details: parsed?.details,
            product_scope: "pulse",
          });
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setBalancesConn("no");
        setBalances({
          ok: false,
          error: e instanceof Error ? e.message : "balances_failed",
          product_scope: "pulse",
        });
      }

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/coinbase/balances?product=atlas", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        if (!mountedRef.current) return;

        const parsed = j as Partial<BalancesOk & BalancesErr>;

        if (r.ok && parsed && parsed.ok === true) {
          setAtlasBalancesConn("ok");
          setAtlasBalances(parsed as BalancesOk);
        } else {
          setAtlasBalancesConn("no");
          setAtlasBalances({
            ok: false,
            error: String(parsed?.error ?? "atlas_balances_failed"),
            status: parsed?.status ?? r.status,
            details: parsed?.details,
            product_scope: "atlas",
          });
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setAtlasBalancesConn("no");
        setAtlasBalances({
          ok: false,
          error: e instanceof Error ? e.message : "atlas_balances_failed",
          product_scope: "atlas",
        });
      }

      try {
        if (!sessionUserId) throw new Error("missing_user_id");
        if (!accessToken) throw new Error("missing_access_token");

        const r = await fetch("/api/pulse-trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
          body: JSON.stringify({ action: "status", user_id: sessionUserId }),
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        const jr = (j ?? {}) as {
          ok?: boolean;
          status?: string;
          gates?: Partial<Record<keyof TradeGates, unknown>>;
        };

        const gates = jr.gates ?? {};
        const parsed: TradeGates = {
          COINBASE_TRADING_ENABLED: truthy(gates.COINBASE_TRADING_ENABLED),
          PULSE_TRADE_ARMED: truthy(gates.PULSE_TRADE_ARMED),
          LIVE_ALLOWED: truthy(gates.LIVE_ALLOWED),
        };

        if (!mountedRef.current) return;

        setTradeGates(parsed);

        const ok = !!(r.ok && jr.ok === true);
        const blocking: string[] = [];
        const next_steps: string[] = [];

        let traffic: Traffic = "unknown";
        let connState: Conn = "checking";

        if (!ok) {
          blocking.push(`Status check failed (HTTP ${r.status}).`);
          next_steps.push("Refresh and try again. If it persists, reconnect Coinbase keys.");
          traffic = "red";
          connState = "no";
        } else {
          if (!userKeysOk) {
            blocking.push("No Pulse Coinbase keys found for your account.");
            next_steps.push("Click Connect Pulse Keys and finish the Pulse Coinbase connection.");
            traffic = "red";
            connState = "no";
          } else if (!parsed.COINBASE_TRADING_ENABLED) {
            blocking.push("Trading is disabled by platform admin.");
            next_steps.push("Admin must enable COINBASE_TRADING_ENABLED=true in Production env and redeploy.");
            traffic = "red";
            connState = "no";
          } else if (!parsed.PULSE_TRADE_ARMED || !parsed.LIVE_ALLOWED) {
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
          rawStatus: jr.status,
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

      try {
        if (!accessToken) throw new Error("missing_access_token");

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const r = await fetch(`/api/pnl-snapshot?since=${encodeURIComponent(since)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        let j: unknown = null;
        try {
          j = await r.json();
        } catch {
          j = null;
        }

        if (!mountedRef.current) return;

        const parsed = j as Partial<PnlSnapshotOk & PnlSnapshotErr>;

        if (r.ok && parsed && parsed.ok === true) {
          setPnlConn("ok");
          setPnlSnapshot(parsed as PnlSnapshotOk);
        } else {
          const errMsg =
            parsed?.error ||
            (r.status === 404 ? "pnl_endpoint_missing" : `pnl_failed_http_${r.status}`);

          setPnlConn("no");
          setPnlSnapshot({ ok: false, error: String(errMsg), runId: parsed?.runId });
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setPnlConn("no");
        setPnlSnapshot({
          ok: false,
          error: e instanceof Error ? e.message : "pnl_failed",
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
        if (document.visibilityState === "visible") {
          runCheck();
        }
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

  const accP = getConnPill(accountConn);
  const healthP = getConnPill(healthConn);
  const planP = getConnPill(planConn);
  const platP = getConnPill(platformEngineConn);
  const userKeysP = getConnPill(userCoinbaseConn);
  const balP = getConnPill(balancesConn);
  const atlasBalP = getConnPill(atlasBalancesConn);
  const tradeP = getConnPill(tradeConn);

  const pnlPerfState = pnlPerfStateFromSnapshot(pnlSnapshot, pnlConn);
  const pnlP = getConnPill(pnlPerfState);

  const shownEmail = displayEmail ?? userEmail ?? null;

  const planText =
    planConn === "ok"
      ? `Pulse: ${entitlements.pulse ? "ON" : "OFF"} · Recon: ${entitlements.recon ? "ON" : "OFF"} · Atlas: ${
          entitlements.atlas ? "ON" : "OFF"
        }`
      : "Unable to read plan entitlements (check login / RLS / API).";

  const armedLabel = tradeGates.LIVE_ALLOWED
    ? { title: "HOT (Live Allowed)", tone: "text-rose-200" }
    : { title: "LOCKED (Safe)", tone: "text-amber-200" };

  const canSeeAtlas = entitlements.atlas || isAdmin;
  const canSeePulsePnl = entitlements.pulse || isAdmin;

  const pnlBox = (() => {
    if (!canSeePulsePnl) {
      return (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-100">PnL Snapshot</p>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold bg-slate-800/60 text-slate-200 ring-1 ring-slate-700">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              LOCKED
            </span>
          </div>
          <p className="mt-1 text-slate-400">Upgrade to Pulse to see your PnL and trade stats.</p>
        </div>
      );
    }

    if (pnlConn !== "ok" || !pnlSnapshot || pnlSnapshot.ok !== true) {
      const err =
        pnlSnapshot && pnlSnapshot.ok === false
          ? pnlSnapshot.error
          : "Unable to load PnL Snapshot. Confirm /api/pnl-snapshot exists.";

      return (
        <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-rose-100">
          <div className="flex items-center justify-between">
            <p className="font-semibold">PnL Snapshot</p>
            <button
              type="button"
              onClick={() => {
                openPillModal({
                  title: "PNL SNAPSHOT",
                  tone: "red",
                  body: [
                    String(err),
                    "This page calls /api/pnl-snapshot (server). It must be authenticated and must not expose secrets.",
                  ],
                  footer: ["Fix the backend route if missing, then refresh."],
                });
              }}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
                pnlP.wrap,
              ].join(" ")}
              title="Click for details"
            >
              <span className={["h-2 w-2 rounded-full", pnlP.dot].join(" ")} />
              PNL: {pnlP.label}
            </button>
          </div>

          <p className="mt-1 opacity-90">{String(err)}</p>
        </div>
      );
    }

    const ok = pnlSnapshot;
    const realized = ok.net_realized_pnl_usd ?? 0;
    const runningEq = ok.running_equity_usd ?? 0;
    const wins = safeCount(ok.wins);
    const losses = safeCount(ok.losses);
    const totalTrades = safeCount(ok.total_trades);
    const winLossDisplay = `${wins}/${losses}`;
    const tradeLineDisplay = `${totalTrades} (${winLossDisplay})`;

    const tone: PillTone =
      realized > 0 ? "green" : realized < -1 ? "red" : realized < 0 ? "yellow" : "neutral";

    return (
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-100">PnL Snapshot</p>

          <button
            type="button"
            onClick={() => {
              openPillModal({
                title: "PNL SNAPSHOT",
                tone,
                body: [
                  `Realized PnL: ${fmtSignedMoney(ok.net_realized_pnl_usd)}`,
                  `Open PnL: ${fmtSignedMoney(ok.current_open_pnl_usd)}`,
                  `W/L: ${winLossDisplay}`,
                  `Trades: ${totalTrades}`,
                  `Win rate: ${typeof ok.win_rate === "number" ? `${ok.win_rate}%` : "—"}`,
                  `Avg win: ${fmtBps(ok.avg_win_bps)} · Avg loss: ${fmtBps(ok.avg_loss_bps)}`,
                  `Running Equity: ${fmtMoney(ok.running_equity_usd)}`,
                  `Max drawdown: ${fmtPct(ok.max_drawdown_pct)}`,
                  `Position: ${fmtNum(ok.open_position_base, 8)} BTC`,
                  `Spot: ${fmtMoney(ok.spot_price ?? null)} · Avg entry: ${fmtMoney(ok.open_avg_price ?? null)}`,
                  `Since: ${ok.since ?? "—"}`,
                ],
                footer: ["PnL Snapshot is read-only and computed from your trade logs."],
              });
            }}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
              pnlP.wrap,
            ].join(" ")}
            title="Click for details"
          >
            <span className={["h-2 w-2 rounded-full", pnlP.dot].join(" ")} />
            PNL: {pnlP.label}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Realized PnL</span>
            <span className="font-mono text-slate-100">{fmtSignedMoney(ok.net_realized_pnl_usd)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Open PnL</span>
            <span className="font-mono text-slate-100">{fmtSignedMoney(ok.current_open_pnl_usd)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">W/L</span>
            <span className="font-mono text-slate-100">{winLossDisplay}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Trades</span>
            <span className="font-mono text-slate-100">{tradeLineDisplay}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Win Rate</span>
            <span className="font-mono text-slate-100">
              {typeof ok.win_rate === "number" ? `${ok.win_rate}%` : "—"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Running Equity</span>
            <span className="font-mono text-slate-100">{fmtMoney(runningEq)}</span>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Since: <span className="text-slate-300">{ok.since ?? "—"}</span>
            <span className="ml-2 text-slate-600">· Auto-refresh: 60s</span>
          </p>
        </div>
      </div>
    );
  })();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status details
                </p>
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
                <p key={idx}>{line}</p>
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

              <StatusButton label="SIGNED IN" pill={accP} />
              <StatusButton label="HEALTH" pill={healthP} />
              <StatusButton label="PLAN ACCESS" pill={planP} />

              <StatusButton
                label="YOUR COINBASE"
                pill={userKeysP}
                onClick={() => {
                  const lines = coinbaseClickMsg()
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);

                  openPillModal({
                    title: "YOUR COINBASE",
                    tone: userCoinbaseConn === "ok" ? "green" : "red",
                    body: lines,
                    footer: ["This is your Pulse connection status (server-verified)."],
                  });
                }}
                title="Click for details"
              />

              <StatusButton
                label="PULSE BALANCES"
                pill={balP}
                onClick={() =>
                  openBalanceModal("PULSE BALANCES", balancesConn, balances, [
                    "Pulse balances are read-only and server-verified.",
                  ])
                }
                title="Click for details"
              />

              {canSeeAtlas && (
                <StatusButton
                  label="ATLAS BALANCES"
                  pill={atlasBalP}
                  onClick={() =>
                    openBalanceModal("ATLAS BALANCES", atlasBalancesConn, atlasBalances, [
                      "Atlas balances are read-only and separate from Pulse.",
                    ])
                  }
                  title="Click for details"
                />
              )}

              <StatusButton
                label="PLATFORM ENGINE"
                pill={platP}
                onClick={() => {
                  const ok = platformEngineConn === "ok" && platformEngineMeta.authOk;

                  openPillModal({
                    title: "PLATFORM ENGINE",
                    tone: ok ? "green" : "red",
                    body: [
                      ok
                        ? "✅ Platform engine can authenticate to Coinbase (server env keys)."
                        : "❌ Platform engine auth is failing.",
                      `Auth status: ${platformEngineMeta.authStatus ?? "—"}`,
                      `Mode: ${platformEngineMeta.mode ?? "—"}`,
                    ],
                    footer: ["This is the platform server connectivity, not your personal keys."],
                  });
                }}
                title="Click for details"
              />

              <StatusButton
                label="TRADING STATUS"
                pill={tradeP}
                onClick={() => {
                  const lines = tradingClickMsg()
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);

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
                title="Click for details"
              />

              <StatusButton
                label="PNL"
                pill={pnlP}
                onClick={() => {
                  if (!pnlSnapshot || pnlSnapshot.ok !== true) {
                    openPillModal({
                      title: "PNL SNAPSHOT",
                      tone: "red",
                      body: [
                        pnlSnapshot && pnlSnapshot.ok === false
                          ? pnlSnapshot.error
                          : "PnL snapshot not available yet.",
                        "This dashboard calls /api/pnl-snapshot (server). No secrets are exposed to the browser.",
                      ],
                      footer: ["If missing, add the server proxy route and refresh."],
                    });
                    return;
                  }

                  const wins = safeCount(pnlSnapshot.wins);
                  const losses = safeCount(pnlSnapshot.losses);
                  const realized = pnlSnapshot.net_realized_pnl_usd ?? 0;

                  openPillModal({
                    title: "PNL SNAPSHOT",
                    tone: realized > 0 ? "green" : realized < -1 ? "red" : realized < 0 ? "yellow" : "neutral",
                    body: [
                      `Realized PnL: ${fmtSignedMoney(pnlSnapshot.net_realized_pnl_usd)}`,
                      `Open PnL: ${fmtSignedMoney(pnlSnapshot.current_open_pnl_usd)}`,
                      `W/L: ${wins}/${losses}`,
                      `Trades: ${safeCount(pnlSnapshot.total_trades)}`,
                      `Win rate: ${typeof pnlSnapshot.win_rate === "number" ? `${pnlSnapshot.win_rate}%` : "—"}`,
                      `Running Equity: ${fmtMoney(pnlSnapshot.running_equity_usd)}`,
                      `Max drawdown: ${fmtPct(pnlSnapshot.max_drawdown_pct)}`,
                      `Position: ${fmtNum(pnlSnapshot.open_position_base, 8)} BTC`,
                      `Spot: ${fmtMoney(pnlSnapshot.spot_price ?? null)} · Avg entry: ${fmtMoney(pnlSnapshot.open_avg_price ?? null)}`,
                      `Since: ${pnlSnapshot.since ?? "—"}`,
                    ],
                    footer: ["Read-only · computed from trade logs."],
                  });
                }}
                title="Click for details"
              />

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
                    href="/connect-keys?product=pulse"
                    className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/25 hover:bg-amber-300"
                  >
                    Connect Pulse Keys
                  </Link>

                  {canSeeAtlas && (
                    <Link
                      href="/connect-keys?product=atlas"
                      className="rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-400/25 hover:bg-indigo-300"
                    >
                      Connect Atlas Keys
                    </Link>
                  )}

                  <Link
                    href="/atlas/quick-start"
                    className="rounded-full border border-slate-700 bg-slate-900/30 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:bg-slate-900/60"
                  >
                    Atlas Quick Start
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

                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Pulse / Recon</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Active trading system and live decision layer.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-slate-200">
                        {entitlements.pulse ? "PULSE ON" : "PULSE OFF"} · {entitlements.recon ? "RECON ON" : "RECON OFF"}
                      </span>
                    </div>
                  </div>

                  {canSeeAtlas && (
                    <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-indigo-50">Atlas</p>
                          <p className="mt-1 text-xs text-indigo-200/80">
                            Long-term allocation track with separate Coinbase scope.
                          </p>
                        </div>
                        <span className="rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold text-indigo-100">
                          {entitlements.atlas ? "ATLAS ON" : "ATLAS OFF"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <BalanceCard
                  title="Pulse Coinbase"
                  scopeLabel="PULSE"
                  conn={balancesConn}
                  balances={balances}
                  onOpenDetails={() =>
                    openBalanceModal("PULSE BALANCES", balancesConn, balances, [
                      "Pulse balances are read-only and server-verified.",
                    ])
                  }
                  emptyMessage="Connect Pulse keys to view balances."
                />

                {canSeeAtlas && (
                  <BalanceCard
                    title="Atlas Coinbase"
                    scopeLabel="ATLAS"
                    conn={atlasBalancesConn}
                    balances={atlasBalances}
                    tone="indigo"
                    onOpenDetails={() =>
                      openBalanceModal("ATLAS BALANCES", atlasBalancesConn, atlasBalances, [
                        "Atlas balances are read-only and separate from Pulse.",
                      ])
                    }
                    emptyMessage="Connect Atlas keys to view balances."
                    subtitle="Separate account. Uses its own Coinbase keys."
                  />
                )}

                {pnlBox}

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">Important</p>
                  <p className="mt-1 text-slate-400">
                    “PLATFORM ENGINE” = server connectivity.
                    <br />
                    “YOUR COINBASE” = your Pulse setup completion.
                    <br />
                    “PULSE BALANCES” = read-only Pulse account snapshot.
                    <br />
                    “ATLAS BALANCES” = read-only Atlas account snapshot.
                    <br />
                    “TRADING STATUS” = per-user Pulse status.
                    <br />
                    “PNL” = user-scoped snapshot computed server-side.
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