import AtlasCard from "./AtlasCard";

export default function AtlasFunnel() {
  return (
    <AtlasCard title="Atlas Funnel">
      <div className="space-y-4">
        <FunnelRow label="Atlas Entitled" value="17" />
        <FunnelRow label="Launch Ready" value="6" />
        <FunnelRow label="Needs Atlas Keys" value="2" />
        <FunnelRow label="Needs Atlas Subscription" value="9" />
      </div>
    </AtlasCard>
  );
}

function FunnelRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-semibold text-white">{props.value}</span>
    </div>
  );
}