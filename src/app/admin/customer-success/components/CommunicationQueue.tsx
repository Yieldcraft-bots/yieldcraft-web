import AtlasCard from "../../atlas-operations/components/AtlasCard";

export default function CommunicationQueue() {
  return (
    <AtlasCard title="Communication Queue">
      <div className="space-y-4">
        <QueueRow
          label="Welcome Pending"
          value="--"
        />

        <QueueRow
          label="Keys Reminder"
          value="--"
        />

        <QueueRow
          label="Weekly Summary Due"
          value="--"
        />

        <QueueRow
          label="Platform Updates"
          value="--"
        />

        <QueueRow
          label="Action Required"
          value="--"
        />
      </div>
    </AtlasCard>
  );
}

function QueueRow(props: {
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