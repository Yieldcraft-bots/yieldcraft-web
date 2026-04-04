"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Resp = {
  ok: boolean;
  as_of?: string;
  institutional?: { ok: boolean; error: any; data: any };
  corefund?: {
    core_user_id: string | null;
    snapshot_source: string | null;
    snapshot: any;
    trades_source: string | null;
    trades: any[];
    limit_trades: number;
  };
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

export default function AdminPlatform() {
  const [data, setData] = useState<Resp | null>(null);
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

      const res = await fetch("/api/admin/institutional-snapshot?limit_trades=50", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = (await res.json()) as Resp;
      if (!res.ok || !json?.ok) {
        throw new Error(
          typeof json?.error === "string" ? json.error : `Request failed (${res.status})`
        );
      }

      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inst = data?.institutional?.data;
  const core = data?.corefund;

  if (loading) {
    return <div className="p-10 text-white/80">Loading platform metrics…</div>;
  }

  if (err) {
    return (
      <div className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="text-3xl font-semibold">Platform</div>
          <div className="mt-3 rounded-2xl bg-red-500/10 p-5 text-red-300 ring-1 ring-red-500/25">
            Error: {err}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">Admin</div>
            <h1 className="mt-1 text-3xl font-semibold">Platform</h1>
            <div className="mt-2 text-sm text-white/70">
              As of: {data.as_of || "—"} <span className="mx-2">•</span> Snapshot:{" "}
              <span className={data.institutional?.ok ? "text-emerald-300" : "text-red-300"}>
                {data.institutional?.ok ? "OK" : "ERROR"}
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
          <div className="text-lg font-semibold">System Health</div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Snapshot Status</div>
              <div className="mt-2 text-3xl font-semibold">
                {data.institutional?.ok ? "OK" : "ERROR"}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Strategy</div>
              <div className="mt-2 text-2xl font-semibold">
                {inst?.strategy_version ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Last Refresh</div>
              <div className="mt-2 text-2xl font-semibold">{data.as_of ?? "—"}</div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Network Health</div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Users (30d)</div>
              <div className="mt-2 text-3xl font-semibold">
                {inst?.total_users_30d ?? "—"}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Active 24h: {inst?.active_users_24h ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Trades (30d)</div>
              <div className="mt-2 text-3xl font-semibold">
                {inst?.total_trades_30d ?? "—"}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Maker entries: {fmtPct(inst?.maker_entry_pct, 2)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Volume (30d)</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtMoney(inst?.total_volume_usd_30d)}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Avg trade: {fmtMoney(inst?.avg_trade_usd_30d)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Win Rate</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtPct(inst?.win_rate_pct, 2)}
              </div>
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
              <div className="text-sm text-white/60">Portfolio DD</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtPct(inst?.dd_pct_portfolio, 2)}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Equity: {fmtMoney(inst?.total_equity_usd)} / Peak:{" "}
                {fmtMoney(inst?.total_peak_equity_usd)}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="text-lg font-semibold">Core Fund Health</div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Peak Equity</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtMoney(core?.snapshot?.peak_equity_usd)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Current Equity</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtMoney(core?.snapshot?.last_equity_usd)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Core Fund DD</div>
              <div className="mt-2 text-3xl font-semibold">
                {fmtPct(core?.snapshot?.dd_pct_portfolio, 2)}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Internal truth account
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10 text-sm text-white/50">
          Platform is for system health only. Trade-by-trade detail belongs in Scout Watch / Core Fund truth surfaces.
        </div>
      </div>
    </main>
  );
}