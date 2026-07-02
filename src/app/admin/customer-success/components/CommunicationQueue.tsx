"use client";

import { useEffect, useState } from "react";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CommunicationData = {
  welcome_pending: number;
  keys_reminder: number;
  weekly_summary_due: number;
  platform_updates: number;
  action_required: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  communication?: CommunicationData;
};

export default function CommunicationQueue() {
  const [communication, setCommunication] = useState<CommunicationData | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    async function loadCommunication() {
      const res = await fetch("/api/admin/customer-success", {
        cache: "no-store",
      });

      const json: CustomerSuccessResponse = await res.json();

      if (alive && json.ok && json.communication) {
        setCommunication(json.communication);
      }
    }

    loadCommunication().catch(console.error);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AtlasCard title="Communication Queue">
      <div className="space-y-4">
        <QueueRow label="Welcome Pending" value={communication?.welcome_pending ?? "--"} />
        <QueueRow label="Keys Reminder" value={communication?.keys_reminder ?? "--"} />
        <QueueRow label="Weekly Summary Due" value={communication?.weekly_summary_due ?? "--"} />
        <QueueRow label="Platform Updates" value={communication?.platform_updates ?? "--"} />
        <QueueRow label="Action Required" value={communication?.action_required ?? "--"} />
      </div>
    </AtlasCard>
  );
}

function QueueRow(props: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-semibold text-white">{props.value}</span>
    </div>
  );
}