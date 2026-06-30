import AtlasCard from "./AtlasCard";

export default function AtlasSummaryCards() {
  return (
    <section className="grid gap-6 md:grid-cols-4">
      <SummaryCard title="Ready" value="--" />
      <SummaryCard title="Cooling Down" value="--" />
      <SummaryCard title="Needs Funds" value="--" />
      <SummaryCard title="Atlas Users" value="--" />
    </section>
  );
}

function SummaryCard(props: { title: string; value: string }) {
  return (
    <AtlasCard title={props.title}>
      <div className="text-4xl font-bold tracking-tight text-white">
        {props.value}
      </div>
    </AtlasCard>
  );
}