"use client";

import { useEffect, useState } from "react";

type TruthResponse = {
  version?: string;
  edge?: {
    edgePerTradeBps?: number;
    sampleSize?: number;
    wins?: number;
    losses?: number;
  };
  system?: {
    status?: string;
    lastAction?: string;
    price?: number | string | null;
    time?: string | null;
  };
  note?: string;
  timestamp?: string;
  error?: string;
  details?: string;
};

export default function TruthPanel() {
  const [data, setData] = useState<TruthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/truth", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) =>
        setData({
          error: "Failed to load network truth layer",
          details: err instanceof Error ? err.message : String(err),
        })
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Truth Layer — Network
        </p>
        <p className="mt-1 text-sm text-slate-500">
          All accounts · Real execution data
        </p>
        <p className="mt-3 text-sm text-slate-300">Loading network truth...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <p className="text-xs uppercase tracking-wide text-red-300">
          Truth Layer — Network
        </p>
        <p className="mt-1 text-sm text-red-300/80">
          All accounts · Real execution data
        </p>
        <p className="mt-3 text-sm text-red-200">
          {data?.error || "Network truth layer unavailable"}
        </p>
        {data?.details ? (
          <p className="mt-2 text-xs text-red-300/80">{data.details}</p>
        ) : null}
      </div>
    );
  }

  const edge = Number(data.edge?.edgePerTradeBps ?? 0);
  const sampleSize = data.edge?.sampleSize ?? 0;
  const wins = data.edge?.wins ?? 0;
  const losses = data.edge?.losses ?? 0;
  const status = data.system?.status ?? "UNKNOWN";
  const lastAction = data.system?.lastAction ?? "NONE";
  const price = data.system?.price ?? "—";
  const note = data.note ?? "No note available";

  const edgeColor =
    edge < 0 ? "text-red-400" : edge > 0 ? "text-emerald-400" : "text-slate-200";

  const statusTone =
    status === "ACTIVE"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
      : status === "HOLD"
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
      : status === "EXIT"
      ? "bg-sky-500/15 text-sky-300 ring-sky-500/25"
      : "bg-slate-500/15 text-slate-300 ring-slate-500/25";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Truth Layer — Network
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Real system truth
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            All accounts · Real execution data
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Edge / Trade</p>
          <p className={`mt-2 text-2xl font-bold ${edgeColor}`}>
            {edge.toFixed(2)} bps
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Sample</p>
          <p className="mt-2 text-2xl font-bold text-white">{sampleSize}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Wins</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{wins}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Losses</p>
          <p className="mt-2 text-2xl font-bold text-red-400">{losses}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Network Status
        </p>
        <p className="mt-2 text-sm text-slate-200">
          {status} — {lastAction} @ {price}
        </p>
        <p className="mt-3 text-xs text-slate-400">{note}</p>
      </div>
    </div>
  );
}