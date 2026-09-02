"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "../../atlas-operations/components/AtlasCard";

type CommunicationData = {
  keys_reminder: number;
  action_required: number;
};

type CustomerSuccessResponse = {
  ok: boolean;
  communication?: CommunicationData;
};

export default function CommunicationQueue() {
  const [communication, setCommunication] =
    useState<CommunicationData | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadCommunication() {
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
          data.communication
        ) {
          setCommunication(data.communication);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!alive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load communication queue."
        );
      }
    }

    void loadCommunication();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AtlasCard title="Communication Queue">
      {errorMessage ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200"
        >
          Communication queue unavailable:{" "}
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        <QueueRow
          label="Keys Reminders"
          value={
            communication?.keys_reminder ??
            "--"
          }
        />

        <QueueRow
          label="Action Required"
          value={
            communication?.action_required ??
            "--"
          }
        />
      </div>
    </AtlasCard>
  );
}

function QueueRow(props: {
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