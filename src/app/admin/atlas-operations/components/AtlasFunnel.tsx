"use client";

import { useEffect, useState } from "react";
import AtlasCard from "./AtlasCard";

type AtlasFunnelData = {
  atlas_entitled: number;
  launch_ready: number;
  needs_atlas_keys: number;
  needs_atlas_subscription: number;
};

type AtlasOpsResponse = {
  ok: boolean;
  funnel?: AtlasFunnelData;
};

export default function AtlasFunnel() {
  const [funnel, setFunnel] = useState<AtlasFunnelData | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadFunnel() {
      const res = await fetch("/api/admin/atlas-ops-status", {
        cache: "no-store",
      });

      const json: AtlasOpsResponse = await res.json();

      if (alive && json.ok && json.funnel) {
        setFunnel(json.funnel);
      }
    }

    loadFunnel().catch(console.error);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AtlasCard title="Atlas Funnel">
      <div className="space-y-4">
        <FunnelRow label="Atlas Entitled" value={funnel?.atlas_entitled ?? "--"} />
        <FunnelRow label="Launch Ready" value={funnel?.launch_ready ?? "--"} />
        <FunnelRow label="Needs Atlas Keys" value={funnel?.needs_atlas_keys ?? "--"} />
        <FunnelRow
          label="Needs Atlas Subscription"
          value={funnel?.needs_atlas_subscription ?? "--"}
        />
      </div>
    </AtlasCard>
  );
}

function FunnelRow(props: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-semibold text-white">{props.value}</span>
    </div>
  );
}