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

type LoadState =
  | { status: "loading" }
  | { status: "success"; summary: AtlasOpsSummary }
  | { status: "error"; message: string };

export default function AtlasSummaryCards() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const response = await fetch("/api/admin/atlas-ops-status", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Atlas Operations request failed with status ${response.status}.`
          );
        }

        const data = (await response.json()) as AtlasOpsResponse;

        if (!data.ok || !data.summary) {
          throw new Error("Atlas Operations summary was unavailable.");
        }

        setState({
          status: "success",
          summary: data.summary,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load Atlas Operations summary.",
        });
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="grid gap-6 md:grid-cols-4">
        <SummaryCard title="Ready" value="--" />
        <SummaryCard title="Cooling Down" value="--" />
        <SummaryCard title="Needs Funds" value="--" />
        <SummaryCard title="Atlas Users" value="--" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6">
        <p className="font-semibold text-rose-300">
          Atlas summary unavailable
        </p>

        <p className="mt-2 text-sm text-rose-200">
          {state.message}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 md:grid-cols-4">
      <SummaryCard title="Ready" value={state.summary.ready} />
      <SummaryCard
        title="Cooling Down"
        value={state.summary.cooldown}
      />
      <SummaryCard
        title="Needs Funds"
        value={state.summary.needs_funds}
      />
      <SummaryCard
        title="Atlas Users"
        value={state.summary.total}
      />
    </section>
  );
}

function SummaryCard(props: {
  title: string;
  value: number | string;
}) {
  return (
    <AtlasCard title={props.title}>
      <div className="text-4xl font-bold tracking-tight text-white">
        {props.value}
      </div>
    </AtlasCard>
  );
}