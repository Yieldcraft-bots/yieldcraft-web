"use client";

import { useEffect, useMemo, useState } from "react";
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
  return n.toFixed(2);
}
function fmtNum(v: any, d = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}
function fmtTime(v: any) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return String(v);
  return d.toLocaleString();
}
function fmtMaybeFixed(v: any, d = 8) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  // base sizes are tiny; keep precision, but avoid crazy long
  return n.toFixed(d).replace(/\.?0+$/, "");
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

      // ✅ request only 5 trades from server
      const res = await fetch("/api/admin/institutional-snapshot?limit_trades=5", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = (await res.json()) as Resp;
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inst = data?.institutional?.data;
  const core = data?.corefund;

  // ✅ guaranteed last 5 (even if server sends more by mistake)
  const rows = useMemo(() => {
    const t = core?.trades || [];
    const arr = Array.isArray(t) ? t : [];
    return arr.slice(0, 5);
  }, [core?.trades]);

  if (loading) {
    return <div className="p-10 text-white/80">Loading platform metrics…</div>;
  }
  if (err) {
    return (
      <div className="p-10 text-white">
        <div className="text-xl font-semibold">Admin Platform</div>
        <div className="mt-2 text-red-300">Error: {err}</div>
        <button
          onClick={load}
          className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold">Admin Platform</div>
            <div className="mt-2 text-white/70">
              As of: {data.as_of ? fmtTime(data.as_of) : "—"} <span className="mx-2">•</span>
              Snapshot:{" "}
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

        {/* KPI grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Users (30d)</div>
            <div className="mt-2 text-3xl font-semibold">{inst?.total_users_30d ?? "—"}</div>
            <div className="mt-2 text-sm text-white/60">Active 24h: {inst?.active_users_24h ?? "—"}</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Trades (30d)</div>
            <div className="mt-2 text-3xl font-semibold">{inst?.total_trades_30d ?? "—"}</div>
            <div className="mt-2 text-sm text-white/60">
              Maker entries: {fmtNum(inst?.maker_entry_pct, 2)}%
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Volume (30d)</div>
            <div className="mt-2 text-3xl font-semibold">${fmtMoney(inst?.total_volume_usd_30d)}</div>
            <div className="mt-2 text-sm text-white/60">Avg trade: ${fmtMoney(inst?.avg_trade_usd_30d)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Win Rate</div>
            <div className="mt-2 text-3xl font-semibold">{fmtNum(inst?.win_rate_pct, 2)}%</div>
            <div className="mt-2 text-sm text-white/60">Avg exit: {fmtNum(inst?.avg_exit_bps, 2)} bps</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Avg Hold</div>
            <div className="mt-2 text-3xl font-semibold">{fmtNum(inst?.avg_hold_minutes, 1)}m</div>
            <div className="mt-2 text-sm text-white/60">Exits counted: {inst?.exits_30d ?? "—"}</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-sm text-white/60">Portfolio DD</div>
            <div className="mt-2 text-3xl font-semibold">{fmtNum(inst?.dd_pct_portfolio, 2)}%</div>
            <div className="mt-2 text-sm text-white/60">
              Equity: ${fmtMoney(inst?.total_equity_usd)} / Peak: ${fmtMoney(inst?.total_peak_equity_usd)}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="text-sm text-white/60">Strategy</div>
          <div className="mt-1 text-lg font-semibold">{inst?.strategy_version ?? "—"}</div>
        </div>

        {/* CoreFund */}
        <div className="mt-10">
          <div className="text-2xl font-semibold">CoreFund</div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Core User</div>
              <div className="mt-2 break-all text-sm font-semibold">{core?.core_user_id ?? "—"}</div>
              <div className="mt-2 text-sm text-white/60">Source: {core?.snapshot_source ?? "—"}</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Peak Equity</div>
              <div className="mt-2 text-3xl font-semibold">${fmtMoney(core?.snapshot?.peak_equity_usd)}</div>
            </div>

            <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Current Equity</div>
              <div className="mt-2 text-3xl font-semibold">${fmtMoney(core?.snapshot?.last_equity_usd)}</div>
            </div>
          </div>
        </div>

        {/* Trades table (LAST 5) */}
        <div className="mt-8 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">Recent Trades</div>
            <div className="text-sm text-white/60">Showing {rows.length} / 5</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left font-medium">Time</th>
                  <th className="py-2 text-left font-medium">Symbol</th>
                  <th className="py-2 text-left font-medium">Side</th>
                  <th className="py-2 text-right font-medium">Base</th>
                  <th className="py-2 text-right font-medium">Quote</th>
                  <th className="py-2 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="text-white/90">
                {rows.map((t: any) => (
                  <tr key={`${t.id ?? ""}-${t.order_id ?? ""}-${t.created_at ?? ""}`} className="border-b border-white/5">
                    <td className="py-2">{fmtTime(t.created_at)}</td>
                    <td className="py-2">{t.symbol ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={
                          t.side === "BUY" ? "text-emerald-300" : t.side === "SELL" ? "text-red-300" : "text-white/80"
                        }
                      >
                        {t.side ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 text-right">{fmtMaybeFixed(t.base_size, 8)}</td>
                    <td className="py-2 text-right">{fmtMaybeFixed(t.quote_size, 8)}</td>
                    <td className="py-2 text-right">{Number.isFinite(Number(t.price)) ? Number(t.price).toFixed(2) : "—"}</td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td className="py-3 text-white/60" colSpan={6}>
                      No trades found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 text-white/50 text-sm">
          Admin-only (Supabase token enforced). No secrets are exposed to the browser.
        </div>
      </div>
    </div>
  );
}