type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

export default function MetricCard({
  label,
  value,
  detail,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>

      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>

      {detail ? (
        <div className="mt-2 text-sm leading-6 text-zinc-400">{detail}</div>
      ) : null}
    </div>
  );
}