"use client";

import { useEffect, useState } from "react";
import AtlasCard from "./AtlasCard";

type AtlasFunnelData = {
  atlas_entitled: number;
  launch_ready: number;
  needs_atlas_keys: number;
  needs_atlas_subscription: number;
};

type AtlasOpsResponse = {
  ok: boolean;
  funnel?: AtlasFunnelData;
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; funnel: AtlasFunnelData }
  | { status: "error"; message: string };

export default function AtlasFunnel() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadFunnel() {
      try {
        const response = await fetch("/api/admin/atlas-ops-status", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Atlas Operations request failed with status ${response.status}.`
          );
        }

        const data = (await response.json()) as AtlasOpsResponse;

        if (!data.ok || !data.funnel) {
          throw new Error("Atlas funnel data was unavailable.");
        }

        setState({
          status: "success",
          funnel: data.funnel,
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
              : "Unable to load Atlas funnel.",
        });
      }
    }

    void loadFunnel();

    return () => {
      controller.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AtlasCard title="Atlas Funnel">
        <p className="text-sm text-slate-400">
          Loading read-only Atlas funnel data...
        </p>
      </AtlasCard>
    );
  }

  if (state.status === "error") {
    return (
      <AtlasCard title="Atlas Funnel">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4">
          <p className="font-semibold text-rose-300">
            Funnel unavailable
          </p>

          <p className="mt-2 text-sm text-rose-200">
            {state.message}
          </p>
        </div>
      </AtlasCard>
    );
  }

  return (
    <AtlasCard title="Atlas Funnel">
      <div className="space-y-4">
        <FunnelRow
          label="Atlas Entitled"
          value={state.funnel.atlas_entitled}
        />
        <FunnelRow
          label="Launch Ready"
          value={state.funnel.launch_ready}
        />
        <FunnelRow
          label="Needs Atlas Keys"
          value={state.funnel.needs_atlas_keys}
        />
        <FunnelRow
          label="Needs Atlas Subscription"
          value={state.funnel.needs_atlas_subscription}
        />
      </div>
    </AtlasCard>
  );
}

function FunnelRow(props: {
  label: string;
  value: number;
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