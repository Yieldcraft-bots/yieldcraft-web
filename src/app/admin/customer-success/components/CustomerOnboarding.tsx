"use client";

import { useEffect, useState } from "react";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CustomerOnboardingData = {
  new_signups: number;
  awaiting_welcome: number;
  waiting_for_keys: number;
  ready_for_atlas: number;
  needs_funding: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  onboarding?: CustomerOnboardingData;
};

export default function CustomerOnboarding() {
  const [onboarding, setOnboarding] = useState<CustomerOnboardingData | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    async function loadOnboarding() {
      const res = await fetch("/api/admin/customer-success", {
        cache: "no-store",
      });

      const json: CustomerSuccessResponse = await res.json();

      if (alive && json.ok && json.onboarding) {
        setOnboarding(json.onboarding);
      }
    }

    loadOnboarding().catch(console.error);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AtlasCard title="Customer Onboarding">
      <div className="space-y-4">
        <OnboardingRow label="New Signups" value={onboarding?.new_signups ?? "--"} />
        <OnboardingRow label="Awaiting Welcome" value={onboarding?.awaiting_welcome ?? "--"} />
        <OnboardingRow label="Waiting For Keys" value={onboarding?.waiting_for_keys ?? "--"} />
        <OnboardingRow label="Ready For Atlas" value={onboarding?.ready_for_atlas ?? "--"} />
        <OnboardingRow label="Needs Funding" value={onboarding?.needs_funding ?? "--"} />
      </div>
    </AtlasCard>
  );
}

function OnboardingRow(props: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-semibold text-white">{props.value}</span>
    </div>
  );
}