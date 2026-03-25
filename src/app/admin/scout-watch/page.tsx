"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  trades: number;
  wins: number;
  losses: number;
  gross_pnl_usd: number;
  avg_edge_bps: number;
  avg_win_bps: number;
  avg_loss_bps: number;
  hard_stops: number;
  trail_stops: number;
};

type BucketStats = {
  trades: number;
  wins: number;
  losses: number;
  gross_pnl_usd: number;
  avg_edge_bps: number;
  avg_win_bps: number;
  avg_loss_bps: number;
  hard_stops: number;
  trail_stops: number;
};

type ClosedTrade = {
  user_id: string;
  entry_at: string;
  exit_at: string;
  held_minutes: number;
  entry_price: number;
  exit_price: number;
  base_size: number;
  quote_entry: number;
  quote_exit: number;
  gross_pnl_usd: number;
  gross_bps: number;
  entry_mode: string;
  exit_reason: string;
  regime: string;
  confidence_bucket: string;
  confidence: number | null;
};

type ScoutWatchResponse = {
  ok: boolean;
  scope: string;
  lookback: number;
  summary: Summary;
  by_entry_mode: Record<string, BucketStats>;
  by_regime: Record<string, BucketStats>;
  by_confidence_bucket: Record<string, BucketStats>;
  recent_closed_trades: ClosedTrade[];
  error?: string;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function DataTable({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, BucketStats>;
}) {
  const entries = Object.entries(rows || {});

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 text-lg font-semibold text-gray-900">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-3 py-2 font-medium">Bucket</th>
              <th className="px-3 py-2 font-medium">Trades</th>
              <th className="px-3 py-2 font-medium">Wins</th>
              <th className="px-3 py-2 font-medium">Losses</th>
              <th className="px-3 py-2 font-medium">Edge (bps)</th>
              <th className="px-3 py-2 font-medium">Avg Win</th>
              <th className="px-3 py-2 font-medium">Avg Loss</th>
              <th className="px-3 py-2 font-medium">Hard Stops</th>
              <th className="px-3 py-2 font-medium">Trail Stops</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, row]) => (
              <tr
                key={key}
                className="border-b border-gray-100 last:border-b-0"
              >
                <td className="px-3 py-2 font-medium text-gray-900">{key}</td>
                <td className="px-3 py-2 text-gray-700">{row.trades}</td>
                <td className="px-3 py-2 text-gray-700">{row.wins}</td>
                <td className="px-3 py-2 text-gray-700">{row.losses}</td>
                <td
                  className={`px-3 py-2 font-medium ${
                    row.avg_edge_bps >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {row.avg_edge_bps}
                </td>
                <td className="px-3 py-2 text-gray-700">{row.avg_win_bps}</td>
                <td className="px-3 py-2 text-gray-700">{row.avg_loss_bps}</td>
                <td className="px-3 py-2 text-gray-700">{row.hard_stops}</td>
                <td className="px-3 py-2 text-gray-700">{row.trail_stops}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScoutWatchAdminPage() {
  const [lookback, setLookback] = useState(250);
  const [data, setData] = useState<ScoutWatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/scout-watch?limit=${lookback}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ScoutWatchResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load Scout Watch");
        }

        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [lookback]);

  const winRate = useMemo(() => {
    if (!data?.summary?.trades) return 0;
    return Math.round((data.summary.wins / data.summary.trades) * 10000) / 100;
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Admin
            </div>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Scout Watch
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Read-only edge engine. Measures what Pulse is actually doing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              Lookback
            </label>
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-600 shadow-sm">
            Loading Scout Watch...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Trades" value={data.summary.trades} />
              <StatCard label="Win Rate" value={`${winRate}%`} />
              <StatCard label="Edge / Trade" value={data.summary.avg_edge_bps} />
              <StatCard
                label="Gross PnL USD"
                value={data.summary.gross_pnl_usd}
              />
              <StatCard label="Hard Stops" value={data.summary.hard_stops} />
              <StatCard label="Trail Stops" value={data.summary.trail_stops} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <DataTable title="By Entry Mode" rows={data.by_entry_mode} />
              <DataTable title="By Regime" rows={data.by_regime} />
              <DataTable
                title="By Confidence Bucket"
                rows={data.by_confidence_bucket}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 text-lg font-semibold text-gray-900">
                Recent Closed Trades
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">Exit Time</th>
                      <th className="px-3 py-2 font-medium">Entry Mode</th>
                      <th className="px-3 py-2 font-medium">Exit Reason</th>
                      <th className="px-3 py-2 font-medium">Regime</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                      <th className="px-3 py-2 font-medium">Held Min</th>
                      <th className="px-3 py-2 font-medium">Gross Bps</th>
                      <th className="px-3 py-2 font-medium">Gross USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_closed_trades.map((trade, idx) => (
                      <tr
                        key={`${trade.user_id}-${trade.exit_at}-${idx}`}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-gray-700">
                          {new Date(trade.exit_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {trade.entry_mode}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {trade.exit_reason}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {trade.regime}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {trade.confidence ?? "n/a"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {trade.held_minutes}
                        </td>
                        <td
                          className={`px-3 py-2 font-medium ${
                            trade.gross_bps >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {trade.gross_bps}
                        </td>
                        <td
                          className={`px-3 py-2 font-medium ${
                            trade.gross_pnl_usd >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {trade.gross_pnl_usd}
                        </td>
                      </tr>
                    ))}
                    {data.recent_closed_trades.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-6 text-center text-gray-500"
                        >
                          No closed trades yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}