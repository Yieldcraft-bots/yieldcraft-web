"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type InstResp = {
  ok: boolean;
  as_of?: string;
  institutional?: { ok: boolean; error: any; data: any };
  corefund?: { snapshot?: any; trades?: any[] };
  error?: string;
};

type SeriesResp = {
  ok: boolean;
  source?: string;
  series?: { t: string; equity: number; peak?: number }[];
  error?: string;
};

function fmtMoney(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtNum(v: any, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function fmtPct(v: any, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(d)}%`;
}

function fmtDateTime(v: any) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

export default function AdminInvestor() {
  const [instData, setInstData] = useState<InstResp | null>(null);
  const [seriesData, setSeriesData] = useState<SeriesResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not signed in. Please login again.");

      const r1 = await fetch("/api/admin/institutional-snapshot?limit_trades=5", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j1 = (await r1.json()) as InstResp;
      if (!r1.ok || !j1?.ok) {
        throw new Error(
          typeof j1?.error === "string" ? j1.error : `Snapshot failed (${r1.status})`
        );
      }
      setInstData(j1);

      const r2 = await fetch("/api/admin/performance-series?days=60", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j2 = (await r2.json()) as SeriesResp;
      if (!r2.ok || !j2?.ok) {
        throw new Error(
          typeof j2?.error === "string" ? j2.error : `Series failed (${r2.status})`
        );
      }
      setSeriesData(j2);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setInstData(null);
      setSeriesData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inst = instData?.institutional?.data;
  const coreSnap = instData?.corefund?.snapshot;

  const series = useMemo(() => {
    const s = seriesData?.series || [];
    return Array.isArray(s) ? s.filter((p) => p?.t && Number.isFinite(p.equity)) : [];
  }, [seriesData?.series]);

  const equityNow =
    Number(coreSnap?.last_equity_usd ?? coreSnap?.equity_usd ?? inst?.total_equity_usd ?? NaN);

  const peakNow =
    Number(coreSnap?.peak_equity_usd ?? inst?.total_peak_equity_usd ?? NaN);

  const ddPct =
    Number.isFinite(equityNow) && Number.isFinite(peakNow) && peakNow > 0
      ? ((peakNow - equityNow) / peakNow) * 100
      : NaN;

  if (loading) {
    return <div className="p-10 text-white/80">Loading investor dashboard…</div>;
  }

  if (err) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-3xl font-semibold">Investor Dashboard</div>
          <div className="mt-3 rounded-2xl bg-red-500/10 p-5 text-red-300 ring-1 ring-red-500/25">
            Error: {err}
          </div>
          <button
            onClick={load}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!instData) return null;

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">Admin</div>
            <div className="mt-1 text-3xl font-semibold">Investor Dashboard</div>
            <div className="mt-2 text-white/70">
              As of: {instData?.as_of ? fmtDateTime(instData.as_of) : "—"}
              <span className="mx-2">•</span>
              Snapshot:{" "}
              <span className={instData?.institutional?.ok ? "text-emerald-300" : "text-red-300"}>
                {instData?.institutional?.ok ? "OK" : "ERROR"}
              </span>
            </div>
          </div>

          <button
            onClick={load}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Refresh
          </button>
        </div>

        <section className="mt-8 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Investor Summary</div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Current Equity</div>
              <div className="mt-2 text-3xl font-semibold">{fmtMoney(equityNow)}</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Peak Equity</div>
              <div className="mt-2 text-3xl font-semibold">{fmtMoney(peakNow)}</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Drawdown</div>
              <div className="mt-2 text-3xl font-semibold">{fmtPct(ddPct, 2)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Win Rate</div>
              <div className="mt-2 text-3xl font-semibold">{fmtPct(inst?.win_rate_pct, 2)}</div>
              <div className="mt-2 text-sm text-white/60">
                Avg exit: {fmtNum(inst?.avg_exit_bps, 2)} bps
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Avg Hold</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtNum(inst?.avg_hold_minutes, 1)}m
              </div>
              <div className="mt-2 text-sm text-white/60">
                Exits counted: {inst?.exits_30d ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Strategy</div>
              <div className="mt-2 text-2xl font-semibold">
                {inst?.strategy_version ?? "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">Equity Curve (CoreFund)</div>
            <div className="text-sm text-white/60">Points: {series.length}</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left font-medium">Time</th>
                  <th className="py-2 text-right font-medium">Equity</th>
                  <th className="py-2 text-right font-medium">Peak</th>
                </tr>
              </thead>
              <tbody className="text-white/90">
                {series.slice(-20).reverse().map((p, idx) => (
                  <tr key={`${p.t}-${idx}`} className="border-b border-white/5">
                    <td className="py-2">{fmtDateTime(p.t)}</td>
                    <td className="py-2 text-right">{fmtMoney(p.equity)}</td>
                    <td className="py-2 text-right">
                      {Number.isFinite(Number(p.peak)) ? fmtMoney(p.peak) : "—"}
                    </td>
                  </tr>
                ))}
                {!series.length && (
                  <tr>
                    <td className="py-3 text-white/60" colSpan={3}>
                      No series yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 text-sm text-white/50">
          Investor page is summary-only. Trade-by-trade detail belongs in Scout Watch / Core Fund truth surfaces.
        </div>
      </div>
    </div>
  );
}