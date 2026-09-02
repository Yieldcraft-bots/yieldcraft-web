"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CustomerSummary = {
  total_customers: number;
  new_this_week: number;
  waiting_keys: number;
  ready_for_atlas: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  summary?: CustomerSummary;
};

export default function CustomerSummaryCards() {
  const [summary, setSummary] =
    useState<CustomerSummary | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSummary() {
      try {
        const data =
          await adminFetch<CustomerSuccessResponse>(
            "/api/admin/customer-success",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (
          alive &&
          data.ok &&
          data.summary
        ) {
          setSummary(data.summary);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!alive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load customer summary."
        );
      }
    }

    void loadSummary();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200"
        >
          Customer summary unavailable:{" "}
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-4">
        <SummaryCard
          title="Customers Tracked"
          value={
            summary?.total_customers ??
            "--"
          }
        />

        <SummaryCard
          title="New — Last 7 Days"
          value={
            summary?.new_this_week ??
            "--"
          }
        />

        <SummaryCard
          title="Waiting Keys"
          value={
            summary?.waiting_keys ??
            "--"
          }
        />

        <SummaryCard
          title="Ready For Atlas"
          value={
            summary?.ready_for_atlas ??
            "--"
          }
        />
      </section>
    </div>
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