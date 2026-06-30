"use client";

import { useEffect, useState } from "react";
import AtlasCard from "./AtlasCard";

type AtlasOpsStatus = {
  summary?: {
    ready?: number;
    cooldown?: number;
    needs_funds?: number;
    error?: number;
  };
};

export default function AtlasExecutionStatus() {
  const [data, setData] = useState<AtlasOpsStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/atlas-ops-status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const summary = data?.summary || {
    ready: 0,
    cooldown: 0,
    needs_funds: 0,
    error: 0,
  };

  return (
    <AtlasCard title="Atlas Execution Status">
      <div className="space-y-4">
        <StatusRow status="READY" count={String(summary.ready)} />
        <StatusRow status="COOLDOWN" count={String(summary.cooldown)} />
        <StatusRow status="NEEDS_FUNDS" count={String(summary.needs_funds)} />
        <StatusRow status="ERROR" count={String(summary.error)} />
      </div>
    </AtlasCard>
  );
}

function StatusRow(props: { status: string; count: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="font-medium text-slate-300">{props.status}</span>
      <span className="font-bold text-white">{props.count}</span>
    </div>
  );
}