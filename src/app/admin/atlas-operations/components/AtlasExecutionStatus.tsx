"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "./AtlasCard";

type AtlasOpsStatus = {
  summary?: {
    ready?: number;
    cooldown?: number;
    needs_funds?: number;
    error?: number;
  };
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; data: AtlasOpsStatus }
  | { status: "error"; message: string };

export default function AtlasExecutionStatus() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadStatus() {
      try {
        const data = await adminFetch<AtlasOpsStatus>(
          "/api/admin/atlas-ops-status",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        setState({
          status: "success",
          data,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load Atlas execution status.",
        });
      }
    }

    void loadStatus();

    return () => {
      controller.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AtlasCard title="Atlas Execution Status">
        <p className="text-sm text-slate-400">
          Loading read-only Atlas status...
        </p>
      </AtlasCard>
    );
  }

  if (state.status === "error") {
    return (
      <AtlasCard title="Atlas Execution Status">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4">
          <p className="font-semibold text-rose-300">
            Status unavailable
          </p>

          <p className="mt-2 text-sm text-rose-200">
            {state.message}
          </p>
        </div>
      </AtlasCard>
    );
  }

  const summary = state.data.summary ?? {};

  return (
    <AtlasCard title="Atlas Execution Status">
      <div className="space-y-4">
        <StatusRow status="READY" count={summary.ready ?? 0} />
        <StatusRow status="COOLDOWN" count={summary.cooldown ?? 0} />
        <StatusRow
          status="NEEDS_FUNDS"
          count={summary.needs_funds ?? 0}
        />
        <StatusRow status="ERROR" count={summary.error ?? 0} />
      </div>
    </AtlasCard>
  );
}

function StatusRow(props: { status: string; count: number }) {
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