"use client";

import { useEffect, useState } from "react";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CustomerSummary = {
  new_this_week: number;
  awaiting_welcome: number;
  waiting_keys: number;
  ready_for_atlas: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  summary?: CustomerSummary;
};

export default function CustomerSummaryCards() {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSummary() {
      const res = await fetch("/api/admin/customer-success", {
        cache: "no-store",
      });

      const json: CustomerSuccessResponse = await res.json();

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
      <SummaryCard
        title="Customers Tracked"
        value={summary?.new_this_week ?? "--"}
      />
      <SummaryCard
        title="Awaiting Welcome"
        value={summary?.awaiting_welcome ?? "--"}
      />
      <SummaryCard
        title="Waiting Keys"
        value={summary?.waiting_keys ?? "--"}
      />
      <SummaryCard
        title="Ready For Atlas"
        value={summary?.ready_for_atlas ?? "--"}
      />
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