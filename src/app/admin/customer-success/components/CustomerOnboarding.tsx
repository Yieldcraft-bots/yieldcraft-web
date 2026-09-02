"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CustomerOnboardingData = {
  total_customers: number;
  new_signups_7d: number;
  waiting_for_keys: number;
  ready_for_atlas: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  onboarding?: CustomerOnboardingData;
};

export default function CustomerOnboarding() {
  const [onboarding, setOnboarding] =
    useState<CustomerOnboardingData | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadOnboarding() {
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
          data.onboarding
        ) {
          setOnboarding(data.onboarding);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!alive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load customer onboarding."
        );
      }
    }

    void loadOnboarding();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AtlasCard title="Customer Onboarding">
      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200"
        >
          Customer onboarding unavailable:{" "}
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        <OnboardingRow
          label="Customers Tracked"
          value={
            onboarding?.total_customers ??
            "--"
          }
        />

        <OnboardingRow
          label="New Signups — Last 7 Days"
          value={
            onboarding?.new_signups_7d ??
            "--"
          }
        />

        <OnboardingRow
          label="Waiting For Keys"
          value={
            onboarding?.waiting_for_keys ??
            "--"
          }
        />

        <OnboardingRow
          label="Ready For Atlas"
          value={
            onboarding?.ready_for_atlas ??
            "--"
          }
        />
      </div>
    </AtlasCard>
  );
}

function OnboardingRow(props: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-slate-400">
        {props.label}
      </span>

      <span className="font-semibold text-white">
        {props.value}
      </span>
    </div>
  );
}