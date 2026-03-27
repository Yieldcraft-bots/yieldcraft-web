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

type InsightItem = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "bad";
};

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return Number(value.toFixed(digits)).toString();
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  return `${Number(value.toFixed(2))}%`;
}

function toneClass(tone: "neutral" | "good" | "bad") {
  if (tone === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (tone === "bad") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  return "border-gray-200 bg-white text-gray-900";
}

function getBestBucket(
  rows: Record<string, BucketStats> | undefined,
  minTrades = 3
): { key: string; row: BucketStats } | null {
  if (!rows) return null;

  const filtered = Object.entries(rows).filter(
    ([, row]) => row && row.trades >= minTrades
  );

  if (!filtered.length) return null;

  filtered.sort((a, b) => b[1].avg_edge_bps - a[1].avg_edge_bps);
  return { key: filtered[0][0], row: filtered[0][1] };
}

function getWorstBucket(
  rows: Record<string, BucketStats> | undefined,
  minTrades = 3
): { key: string; row: BucketStats } | null {
  if (!rows) return null;

  const filtered = Object.entries(rows).filter(
    ([, row]) => row && row.trades >= minTrades
  );

  if (!filtered.length) return null;

  filtered.sort((a, b) => a[1].avg_edge_bps - b[1].avg_edge_bps);
  return { key: filtered[0][0], row: filtered[0][1] };
}

function buildInsights(
  data: ScoutWatchResponse | null,
  winRate: number
): InsightItem[] {
  if (!data) return [];

  const insights: InsightItem[] = [];
  const summary = data.summary;

  const bestEntry = getBestBucket(data.by_entry_mode, 3);
  const worstEntry = getWorstBucket(data.by_entry_mode, 3);
  const bestRegime = getBestBucket(data.by_regime, 3);
  const worstRegime = getWorstBucket(data.by_regime, 3);
  const bestConfidence = getBestBucket(data.by_confidence_bucket, 3);
  const worstConfidence = getWorstBucket(data.by_confidence_bucket, 3);

  insights.push({
    label: "Primary Diagnosis",
    value:
      summary.avg_edge_bps >= 0
        ? `System edge is currently positive at ${formatNumber(
            summary.avg_edge_bps
          )} bps/trade.`
        : `System edge is currently negative at ${formatNumber(
            summary.avg_edge_bps
          )} bps/trade.`,
    tone: summary.avg_edge_bps >= 0 ? "good" : "bad",
  });

  if (summary.avg_loss_bps < 0 && Math.abs(summary.avg_loss_bps) > summary.avg_win_bps) {
    insights.push({
      label: "Loss Profile",
      value: `Average loss (${formatNumber(
        summary.avg_loss_bps
      )} bps) is larger than average win (${formatNumber(
        summary.avg_win_bps
      )} bps).`,
      tone: "bad",
    });
  } else {
    insights.push({
      label: "Loss Profile",
      value: `Average win/loss structure is currently controlled (${formatNumber(
        summary.avg_win_bps
      )} / ${formatNumber(summary.avg_loss_bps)} bps).`,
      tone: "good",
    });
  }

  if (worstEntry) {
    insights.push({
      label: "Weakest Entry Path",
      value: `${worstEntry.key} is the weakest execution path at ${formatNumber(
        worstEntry.row.avg_edge_bps
      )} bps over ${worstEntry.row.trades} trades.`,
      tone: worstEntry.row.avg_edge_bps < 0 ? "bad" : "neutral",
    });
  }

  if (bestEntry) {
    insights.push({
      label: "Strongest Entry Path",
      value: `${bestEntry.key} is the strongest execution path at ${formatNumber(
        bestEntry.row.avg_edge_bps
      )} bps over ${bestEntry.row.trades} trades.`,
      tone: bestEntry.row.avg_edge_bps >= 0 ? "good" : "neutral",
    });
  }

  if (worstRegime) {
    insights.push({
      label: "Weakest Regime",
      value: `${worstRegime.key} is the weakest market state at ${formatNumber(
        worstRegime.row.avg_edge_bps
      )} bps over ${worstRegime.row.trades} trades.`,
      tone: worstRegime.row.avg_edge_bps < 0 ? "bad" : "neutral",
    });
  }

  if (bestRegime) {
    insights.push({
      label: "Strongest Regime",
      value: `${bestRegime.key} is the strongest market state at ${formatNumber(
        bestRegime.row.avg_edge_bps
      )} bps over ${bestRegime.row.trades} trades.`,
      tone: bestRegime.row.avg_edge_bps >= 0 ? "good" : "neutral",
    });
  }

  if (worstConfidence) {
    insights.push({
      label: "Weakest Confidence Bucket",
      value: `${worstConfidence.key} is weakest at ${formatNumber(
        worstConfidence.row.avg_edge_bps
      )} bps over ${worstConfidence.row.trades} trades.`,
      tone: worstConfidence.row.avg_edge_bps < 0 ? "bad" : "neutral",
    });
  }

  if (bestConfidence) {
    insights.push({
      label: "Strongest Confidence Bucket",
      value: `${bestConfidence.key} is strongest at ${formatNumber(
        bestConfidence.row.avg_edge_bps
      )} bps over ${bestConfidence.row.trades} trades.`,
      tone: bestConfidence.row.avg_edge_bps >= 0 ? "good" : "neutral",
    });
  }

  if (summary.hard_stops > summary.trail_stops) {
    insights.push({
      label: "Stop Pattern",
      value: `Hard stops are dominating (${summary.hard_stops} hard stops vs ${summary.trail_stops} trail stops).`,
      tone: "bad",
    });
  } else {
    insights.push({
      label: "Stop Pattern",
      value: `Trail exits are keeping pace with hard stops (${summary.trail_stops} trail stops vs ${summary.hard_stops} hard stops).`,
      tone: "good",
    });
  }

  insights.push({
    label: "Sample Context",
    value:
      data.summary.trades < 30
        ? `Low sample environment (${data.summary.trades} trades). Treat conclusions as early signal, not final truth.`
        : `Sample is building (${data.summary.trades} trades, ${formatPercent(
            winRate
          )} win rate). Continue validating before changing core logic.`,
    tone: data.summary.trades < 30 ? "neutral" : "good",
  });

  return insights.slice(0, 8);
}

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

function InsightCard({ item }: { item: InsightItem }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass(item.tone)}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">
        {item.label}
      </div>
      <div className="mt-2 text-sm leading-6">{item.value}</div>
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

  const insights = useMemo(() => buildInsights(data, winRate), [data, winRate]);

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
              Read-only edge microscope. Explains where Pulse is gaining or
              losing edge across execution path, regime, and confidence.
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

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    Insight Panel
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Read-only diagnosis from completed trades. No live trading
                    logic changes happen here.
                  </p>
                </div>
                <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600">
                  Diagnostic Only
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {insights.map((item, idx) => (
                  <InsightCard key={`${item.label}-${idx}`} item={item} />
                ))}
              </div>
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