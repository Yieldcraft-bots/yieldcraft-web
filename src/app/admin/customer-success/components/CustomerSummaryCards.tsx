import AtlasCard from "../../atlas-operations/components/AtlasCard";

export default function CustomerSummaryCards() {
  return (
    <section className="grid gap-6 md:grid-cols-4">
      <SummaryCard
        title="New This Week"
        value="--"
      />

      <SummaryCard
        title="Awaiting Welcome"
        value="--"
      />

      <SummaryCard
        title="Waiting Keys"
        value="--"
      />

      <SummaryCard
        title="Ready For Atlas"
        value="--"
      />
    </section>
  );
}

function SummaryCard(props: {
  title: string;
  value: string;
}) {
  return (
    <AtlasCard title={props.title}>
      <div className="text-4xl font-bold tracking-tight text-white">
        {props.value}
      </div>
    </AtlasCard>
  );
}