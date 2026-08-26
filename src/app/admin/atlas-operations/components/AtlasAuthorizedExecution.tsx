"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import AtlasCard from "./AtlasCard";

type ExecutableOrder = {
  symbol?: string;
  productId?: string;
  proposedBuyUsd?: number;
  reason?: string;
};

type ReadyResponse = {
  ok: boolean;
  status: string;
  message?: string;

  authorization?: {
    authorizationId: string;
    approvalId: string;
    userId: string;
    portfolioPlanId: string;
    authorizedAt?: string | null;
  };

  plan?: {
    deployableUsd: number;
    plannedUsd: number;
    unplannedUsd: number;
    executableOrders: ExecutableOrder[];
  };

  execution?: string;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ReadyResponse }
  | { status: "error"; message: string };

export default function AtlasAuthorizedExecution() {
  const [state, setState] = useState<LoadState>({
    status: "idle",
  });

  async function loadAuthorizedPlan() {
    setState({
      status: "loading",
    });

    try {
      const data = await adminFetch<ReadyResponse>(
        "/api/admin/atlas-authorized-execution",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inspect: true,
          }),
        }
      );

      setState({
        status: "success",
        data,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load authorized Atlas plan.",
      });
    }
  }

  return (
    <AtlasCard title="Atlas Authorized Execution">
      <div className="space-y-5">
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-5">
          <p className="font-semibold text-sky-200">
            Governed Execution Boundary
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Displays the latest persisted Atlas portfolio plan
            that has passed both approval and execution
            authorization.
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Loading this panel does not submit an order.
          </p>
        </div>

        <button
          type="button"
          disabled={state.status === "loading"}
          onClick={loadAuthorizedPlan}
          className="w-full rounded-xl bg-sky-600 px-5 py-4 font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.status === "loading"
            ? "Loading Authorized Plan..."
            : "Load Authorized Atlas Plan"}
        </button>

        {state.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
            {state.message}
          </div>
        )}

        {state.status === "success" && (
          <AuthorizedPlan data={state.data} />
        )}
      </div>
    </AtlasCard>
  );
}

function AuthorizedPlan({
  data,
}: {
  data: ReadyResponse;
}) {
  const authorization = data.authorization;
  const plan = data.plan;

  if (!authorization || !plan) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
        Atlas did not return a complete authorized plan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Status
            </p>

            <p className="mt-1 text-xl font-bold text-emerald-200">
              AUTHORIZED READY
            </p>
          </div>

          <div className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
            Execution: {data.execution ?? "NOT_CALLED"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Deployable"
          value={`$${plan.deployableUsd.toFixed(2)}`}
        />

        <Metric
          label="Authorized Now"
          value={`$${plan.plannedUsd.toFixed(2)}`}
        />

        <Metric
          label="Remaining"
          value={`$${plan.unplannedUsd.toFixed(2)}`}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <p className="text-sm font-semibold text-white">
          Executable Instructions
        </p>

        <div className="mt-4 space-y-3">
          {plan.executableOrders.map((order, index) => (
            <div
              key={`${order.productId ?? order.symbol}-${index}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900 p-4"
            >
              <div>
                <p className="text-lg font-bold text-white">
                  {order.symbol ?? "Unknown"}
                </p>

                <p className="text-sm text-slate-400">
                  {order.productId ?? "No product ID"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold text-emerald-300">
                  $
                  {Number(
                    order.proposedBuyUsd ?? 0
                  ).toFixed(2)}
                </p>

                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {order.reason ?? "ready"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-xs text-slate-400">
        <p>
          User:{" "}
          <span className="text-slate-300">
            {authorization.userId}
          </span>
        </p>

        <p className="mt-2">
          Plan:{" "}
          <span className="text-slate-300">
            {authorization.portfolioPlanId}
          </span>
        </p>

        <p className="mt-2">
          Approval:{" "}
          <span className="text-slate-300">
            {authorization.approvalId}
          </span>
        </p>

        <p className="mt-2">
          Authorization:{" "}
          <span className="text-slate-300">
            {authorization.authorizationId}
          </span>
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}