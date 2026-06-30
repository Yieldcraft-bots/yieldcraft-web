import AtlasCard from "./AtlasCard";

export default function AtlasExecutionStatus() {
  return (
    <AtlasCard title="Atlas Execution Status">
      <div className="space-y-4">
        <StatusRow status="READY" count="--" />
        <StatusRow status="COOLDOWN" count="--" />
        <StatusRow status="NEEDS_FUNDS" count="--" />
        <StatusRow status="NEEDS_KEYS" count="--" />
      </div>
    </AtlasCard>
  );
}

function StatusRow(props: { status: string; count: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="font-medium text-slate-300">
        {props.status}
      </span>

      <span className="font-bold text-white">
        {props.count}
      </span>
    </div>
  );
}