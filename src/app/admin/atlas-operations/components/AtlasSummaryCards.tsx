"use client";

import { useEffect, useState } from "react";
import AtlasCard from "./AtlasCard";

type AtlasOpsSummary = {
  total: number;
  ready: number;
  cooldown: number;
  needs_funds: number;
  error: number;
};

type AtlasOpsResponse = {
  ok: boolean;
  summary?: AtlasOpsSummary;
};

export default function AtlasSummaryCards() {
  const [summary, setSummary] = useState<AtlasOpsSummary | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSummary() {
      const res = await fetch("/api/admin/atlas-ops-status", {
        cache: "no-store",
      });

      const json: AtlasOpsResponse = await res.json();

      if (alive && json.ok && json.summary) {
        setSummary(json.summary);
      }
    }

    loadSummary().catch(console.error);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="grid gap-6 md:grid-cols-4">
      <SummaryCard title="Ready" value={summary?.ready ?? "--"} />
      <SummaryCard title="Cooling Down" value={summary?.cooldown ?? "--"} />
      <SummaryCard title="Needs Funds" value={summary?.needs_funds ?? "--"} />
      <SummaryCard title="Atlas Users" value={summary?.total ?? "--"} />
    </section>
  );
}

function SummaryCard(props: { title: string; value: number | string }) {
  return (
    <AtlasCard title={props.title}>
      <div className="text-4xl font-bold tracking-tight text-white">
        {props.value}
      </div>
    </AtlasCard>
  );
}