"use client";

/**
 * ============================================================
 * Atlas Operations
 * Intelligence Health
 * ------------------------------------------------------------
 * PURPOSE
 * Display read-only Atlas Intelligence and Atlas Labs health.
 *
 * Single Responsibility:
 * Fetch and render the Atlas Operations regression snapshot.
 *
 * This component performs NO business logic.
 * This component performs NO execution.
 * This component performs NO persistence.
 * This component performs NO trading.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No Database writes
 * - No Orders
 * ============================================================
 */

import { useEffect, useState } from "react";

interface AtlasRegressionSummary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  passed: boolean;
}

interface AtlasOperationsSnapshot {
  generatedAt: string;
  overallHealthy: boolean;
  status: {
    generatedAt: string;
    regression: AtlasRegressionSummary;
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; snapshot: AtlasOperationsSnapshot }
  | { status: "error"; message: string };

export default function AtlasIntelligenceHealth() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadSnapshot() {
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

        const snapshot =
          (await response.json()) as AtlasOperationsSnapshot;

        setState({
          status: "success",
          snapshot,
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
              : "Unable to load Atlas Intelligence health.",
        });
      }
    }

    void loadSnapshot();

    return () => {
      controller.abort();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
        <p className="text-sm font-semibold text-slate-200">
          Atlas Intelligence Health
        </p>

        <p className="mt-3 text-sm text-slate-400">
          Loading the read-only Atlas Labs regression snapshot...
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6">
        <p className="text-sm font-semibold text-rose-300">
          Atlas Intelligence Health
        </p>

        <p className="mt-3 text-sm text-rose-200">
          {state.message}
        </p>
      </section>
    );
  }

  const { snapshot } = state;
  const { regression } = snapshot.status;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400">
            Read-Only Intelligence
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-50">
            Atlas Intelligence Health
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Structural and baseline validation status from the Atlas
            Labs regression suite.
          </p>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${
            snapshot.overallHealthy
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {snapshot.overallHealthy ? "Healthy" : "Attention Required"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Regression Status
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-50">
            {regression.passed ? "PASS" : "FAIL"}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Total Scenarios
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-50">
            {regression.totalScenarios}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Passed
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {regression.passedScenarios}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Failed
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              regression.failedScenarios === 0
                ? "text-slate-50"
                : "text-rose-300"
            }`}
          >
            {regression.failedScenarios}
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs text-slate-500">
        Snapshot generated{" "}
        {new Date(snapshot.generatedAt).toLocaleString()}.
      </p>
    </section>
  );
}