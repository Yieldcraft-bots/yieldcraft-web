"use client";

/**
 * ============================================================
 * Atlas Operations
 * System Health
 * ------------------------------------------------------------
 * PURPOSE
 * Read-only operational health overview.
 *
 * Fetches current Atlas health checks from the read-only
 * Atlas Operations status API.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No trading
 * - No writes
 * - No policy changes
 * ============================================================
 */

import { useEffect, useState } from "react";

type AtlasHealthCheck = {
  name: string;
  healthy: boolean;
  description: string;
};

type AtlasOperationsStatus = {
  generatedAt: string;
  health: AtlasHealthCheck[];
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; data: AtlasOperationsStatus }
  | { status: "error"; message: string };

function badgeClasses(healthy: boolean) {
  return healthy
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export default function AtlasSystemHealth() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        const response = await fetch(
          "/api/admin/atlas-operations-status",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Atlas Operations request failed with status ${response.status}.`
          );
        }

        const data = (await response.json()) as AtlasOperationsStatus;

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
              : "Unable to load Atlas system health.",
        });
      }
    }

    void loadHealth();

    return () => {
      controller.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
          Read-Only Operations
        </p>

        <h2 className="mt-2 text-2xl font-bold text-slate-50">
          Atlas System Health
        </h2>

        <p className="mt-3 text-sm text-slate-400">
          Loading current Atlas operational health...
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">
          Read-Only Operations
        </p>

        <h2 className="mt-2 text-2xl font-bold text-slate-50">
          Atlas System Health
        </h2>

        <p className="mt-3 text-sm text-rose-200">
          {state.message}
        </p>
      </section>
    );
  }

  const systems = state.data.health;
  const healthyCount = systems.filter(
    (system) => system.healthy
  ).length;
  const allHealthy =
    systems.length > 0 && healthyCount === systems.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
            Read-Only Operations
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-50">
            Atlas System Health
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Current health of Atlas operational services and intelligence
            components.
          </p>
        </div>

        <div
          className={`rounded-xl border px-4 py-3 ${
            allHealthy
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <div
            className={`text-xs uppercase tracking-wider ${
              allHealthy ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            Healthy Systems
          </div>

          <div className="mt-1 text-2xl font-bold text-white">
            {healthyCount} / {systems.length}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {systems.map((system) => (
          <div
            key={system.name}
            className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950 p-4"
          >
            <div>
              <h3 className="font-semibold text-slate-100">
                {system.name}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                {system.description}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(
                system.healthy
              )}`}
            >
              {system.healthy ? "Healthy" : "Warning"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate-500">
        Health snapshot generated{" "}
        {new Date(state.data.generatedAt).toLocaleString()}.
      </p>
    </section>
  );
}