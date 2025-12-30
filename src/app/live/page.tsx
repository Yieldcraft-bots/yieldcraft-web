// src/app/live/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  | { ok: boolean; status: string; [k: string]: any };

function fmtMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toFixed(2)}`;
}
function fmtPct(x: number) {
  return `${(x * 100).toFixed(0)}%`;
}

function Pill({
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
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}

export default function LiveSnapshotPage() {
  const [data, setData] = useState<PulseStatsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ts, setTs] = useState<number>(Date.now());

  async function load() {
    try {
      setErr(null);
      const r = await fetch("/api/pulse-stats", { cache: "no-store" });
      const j = (await r.json()) as PulseStatsResp;
      setData(j);
      setTs(Date.now());
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const ready = data && (data as any).status === "PULSE_STATS_READY";
  const stats = ready ? (data as any).stats : null;

  const netTone: "green" | "yellow" | "red" | "gray" = useMemo(() => {
    if (!stats) return "gray";
    if (stats.netPnL > 0) return "green";
    if (stats.netPnL < 0) return "red";
    return "yellow";
  }, [stats]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Live Trading Snapshot</h1>
            <p className="mt-1 text-sm text-white/60">
              Proof-of-life metrics. Calm execution. No forced trades.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill label="LIVE EXECUTION: ACTIVE" tone="green" />
            <Pill label="AUTO MODE: ACTIVE" tone="green" />
            <Pill label={`NET P&L TODAY: ${stats ? fmtMoney(stats.netPnL) : "—"}`} tone={netTone} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Trades Today</div>
            <div className="mt-2 text-3xl font-semibold">{stats ? stats.trades : "—"}</div>
            <div className="mt-2 text-xs text-white/50">Updates every 30s</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Win Rate</div>
            <div className="mt-2 text-3xl font-semibold">
              {stats && stats.winRate != null ? fmtPct(stats.winRate) : "—"}
            </div>
            <div className="mt-2 text-xs text-white/50">
              Wins: <span className="text-white/70">{stats ? stats.wins : "—"}</span> • Sells:{" "}
              <span className="text-white/70">{stats ? stats.sells : "—"}</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-xs text-white/60">Net P&L Today</div>
            <div className="mt-2 text-3xl font-semibold">{stats ? fmtMoney(stats.netPnL) : "—"}</div>
            <div className="mt-2 text-xs text-white/50">
              Fees: <span className="text-white/70">{stats ? fmtMoney(stats.totalFees) : "—"}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/3 p-5 ring-1 ring-white/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              Day start (Central):{" "}
              <span className="text-white/90">{ready ? (data as any).dayStart : "—"}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
              >
                Refresh
              </button>
              <Link
                href="/dashboard"
                className="rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
              {err}
            </div>
          ) : null}

          <div className="mt-4 text-xs text-white/40">
            Last refresh: {new Date(ts).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </main>
  );
}
