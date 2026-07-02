import AtlasCard from "../../atlas-operations/components/AtlasCard";

export default function CustomerOnboarding() {
  return (
    <AtlasCard title="Customer Onboarding">
      <div className="space-y-4">
        <OnboardingRow
          label="New Signups"
          value="--"
        />

        <OnboardingRow
          label="Awaiting Welcome"
          value="--"
        />

        <OnboardingRow
          label="Waiting For Keys"
          value="--"
        />

        <OnboardingRow
          label="Ready For Atlas"
          value="--"
        />

        <OnboardingRow
          label="Needs Funding"
          value="--"
        />
      </div>
    </AtlasCard>
  );
}

function OnboardingRow(props: {
  label: string;
  value: string;
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