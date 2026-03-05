```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

type PulseStatsResp =
  | {
      ok: true;
      status: "PULSE_STATS_READY";
      dayStart: string;
      table: string;
      counts: { rows: number };
      stats: {
        trades: number;
        sells: number;
        wins: number;
        winRate: number | null;
        grossPnL: number;
        totalFees: number;
        netPnL: number;
      };
    }
  | { ok: boolean; status: string; error?: string; [k: string]: any };

type InstSnapshotResp =
  | {
      ok: true;
      as_of?: string;
      institutional?: { ok: boolean; error?: string | null; data?: any };
      corefund?: {
        snapshot_source?: string | null;
        snapshot?: {
          user_id?: string;
          as_of?: string;
          updated_at?: string;
          peak_equity_usd?: number;
          last_equity_usd?: number;
          dd_pct_portfolio?: number;
          total_volume_usd_30d?: number;
          total_trades_30d?: number;
          win_rate_pct?: number;
          avg_hold_minutes?: number;
        } | null;
        trades_source?: string | null;
        trades?: Array<any>;
        limit_trades?: number;
        core_user_id?: string | null;
      };
      error?: string;
      status?: string;
      [k: string]: any;
    }
  | { ok: boolean; status?: string; error?: string; [k: string]: any };

function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toFixed(2)}`;
}

function pct(n: any, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtDate(s: any) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString();
}

function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "gray";
}) {
  const cls = useMemo(() => {
    switch (tone) {
      case "green":
        return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
      case "yellow":
        return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
      case "red":
        return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30";
      default:
        return "bg-white/5 text-white/70 ring-1 ring-white/10";
    }
  }, [tone]);

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}
    >
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {sub ? <div className="mt-2 text-xs text-white/45">{sub}</div> : null}
    </div>
  );
}

export default function Admin() {
  const router = useRouter();

  const [pulse, setPulse] = useState<PulseStatsResp | null>(null);
  const [inst, setInst] = useState<InstSnapshotResp | null>(null);

  const [errPulse, setErrPulse] = useState<string | null>(null);
  const [errInst, setErrInst] = useState<string | null>(null);

  const [ts, setTs] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!mounted) return;

      if (!user || user.id !== ADMIN_USER_ID) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function loadPulse() {
    try {
      setErrPulse(null);
      const r = await fetch("/api/pulse-stats", { cache: "no-store" });
      const j = (await r.json()) as PulseStatsResp;
      setPulse(j);

      if ((j as any)?.error) {
        setErrPulse((j as any).error);
      }
    } catch (e: any) {
      setErrPulse(e?.message || String(e));
    }
  }

  async function loadInst() {
    try {
      setErrInst(null);

      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;

      if (!token) {
        setErrInst("No Supabase session token found.");
        return;
      }

      const r = await fetch("/api/admin/institutional-snapshot", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const j = (await r.json()) as InstSnapshotResp;
      setInst(j);

      if ((j as any)?.error) {
        setErrInst((j as any).error);
      }
    } catch (e: any) {
      setErrInst(e?.message || String(e));
    }
  }

  async function refreshAll() {
    await Promise.all([loadPulse(), loadInst()]);
    setTs(Date.now());
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30000);
    return () => clearInterval(id);
  }, []);

  const pulseReady = pulse && (pulse as any).status === "PULSE_STATS_READY";
  const pStats = pulseReady ? (pulse as any).stats : null;

  const netTone = useMemo(() => {
    if (!pStats) return "gray";
    if (pStats.netPnL > 0) return "green";
    if (pStats.netPnL < 0) return "red";
    return "yellow";
  }, [pStats]);

  const instOk = !!inst && (inst as any).ok === true;
  const instData = instOk ? (inst as any).institutional?.data : null;

  const cf = instOk ? (inst as any).corefund : null;
  const cfSnap = cf?.snapshot || null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <div className="text-xs text-white/50">ADMIN</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Mission Control
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <TonePill label="LIVE EXECUTION: ON" tone="green" />

            <TonePill
              label={`NET P&L TODAY: ${pStats ? money(pStats.netPnL) : "—"}`}
              tone={netTone as any}
            />

            <button
              onClick={refreshAll}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/admin/investor")}
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm ring-1 ring-indigo-500/30 hover:bg-indigo-500/30"
            >
              Investor / Equity
            </button>

          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          <section className="rounded-3xl bg-white/4 p-6 ring-1 ring-white/10">

            <h2 className="text-lg font-semibold">Pulse — Today</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">

              <Stat
                label="Trades Today"
                value={pStats ? String(pStats.trades) : "—"}
              />

              <Stat
                label="Win Rate"
                value={
                  pStats && pStats.winRate != null
                    ? `${Math.round(pStats.winRate * 100)}%`
                    : "—"
                }
              />

              <Stat
                label="Net P&L Today"
                value={pStats ? money(pStats.netPnL) : "—"}
              />

            </div>

            {errPulse && (
              <div className="mt-4 text-sm text-red-400">{errPulse}</div>
            )}

          </section>

          <section className="rounded-3xl bg-white/4 p-6 ring-1 ring-white/10">

            <h2 className="text-lg font-semibold">Platform Snapshot</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">

              <Stat
                label="Users (30d)"
                value={instData ? String(instData.total_users_30d) : "—"}
              />

              <Stat
                label="Trades (30d)"
                value={instData ? String(instData.total_trades_30d) : "—"}
              />

              <Stat
                label="Volume (30d)"
                value={instData ? money(instData.total_volume_usd_30d) : "—"}
              />

            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <Stat
                label="CoreFund Peak Equity"
                value={cfSnap ? money(cfSnap.peak_equity_usd) : "—"}
              />

              <Stat
                label="CoreFund Current Equity"
                value={cfSnap ? money(cfSnap.last_equity_usd) : "—"}
                sub={
                  cfSnap?.dd_pct_portfolio != null
                    ? `Drawdown: ${pct(cfSnap.dd_pct_portfolio)}`
                    : undefined
                }
              />

            </div>

            {errInst && (
              <div className="mt-4 text-sm text-red-400">{errInst}</div>
            )}

          </section>

        </div>

        <div className="mt-8 text-xs text-white/35">
          Admin page locked to your Supabase user ID.
        </div>

      </div>
    </main>
  );
}
```
