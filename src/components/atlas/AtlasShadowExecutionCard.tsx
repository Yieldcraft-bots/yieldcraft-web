/**
 * ============================================================
 * Atlas Shadow Execution Card
 * ------------------------------------------------------------
 * PURPOSE
 * Render an Atlas shadow execution bridge report.
 *
 * SAFETY
 * - Presentation only
 * - No fetching
 * - No mutations
 * - No trading
 * - No Coinbase
 * - No Pulse
 * - No Atlas execution
 *
 * The parent page is responsible for supplying the report.
 * ============================================================
 */

import type {
  AtlasExecutionBridgeResult,
  ExecutionReadiness,
} from "@/lib/atlas-execution-bridge";

type AtlasShadowExecutionCardProps = {
  report: AtlasExecutionBridgeResult | null;
  generatedAt?: string | null;
};

function readinessLabel(readiness: ExecutionReadiness): string {
  switch (readiness) {
    case "READY":
      return "Ready";
    case "PARTIAL":
      return "Partial";
    case "BLOCKED":
      return "Blocked";
  }
}

function readinessClasses(
  readiness: ExecutionReadiness
): string {
  switch (readiness) {
    case "READY":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "PARTIAL":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "BLOCKED":
      return "border-red-500/30 bg-red-500/10 text-red-300";
  }
}

function formatReason(reason: string): string {
  return reason
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function AtlasShadowExecutionCard({
  report,
  generatedAt = null,
}: AtlasShadowExecutionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">
              Multi-Asset Shadow Readiness
            </h2>

            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-sky-300">
              Shadow
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Read-only classification of proposed Atlas
            instructions. No orders are submitted.
          </p>
        </div>

        {report ? (
          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${readinessClasses(
              report.readiness
            )}`}
          >
            {readinessLabel(report.readiness)}
          </span>
        ) : null}
      </div>

      {!report ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm font-medium text-slate-300">
            No shadow report available
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Atlas has not supplied a shadow execution report
            for this view.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Readiness"
              value={readinessLabel(report.readiness)}
            />

            <Metric
              label="Executable"
              value={String(report.executableCount)}
            />

            <Metric
              label="Blocked"
              value={String(report.blockedCount)}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Executable Instructions
              </h3>

              {report.instructions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No executable instructions.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {report.instructions.map(
                    (instruction, index) => (
                      <div
                        key={`${instruction.brokerId}-${instruction.productId}-${index}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {instruction.symbol}
                          </p>

                          <p className="text-xs text-slate-500">
                            {instruction.brokerId} ·{" "}
                            {instruction.productId}
                          </p>
                        </div>

                        <p className="text-sm font-semibold text-slate-200">
                          $
                          {instruction.quoteSizeUsd.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Blocked Reasons
              </h3>

              {Object.keys(report.blockedReasons).length ===
              0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No blocked reasons.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {Object.entries(report.blockedReasons)
                    .sort(([, left], [, right]) => right - left)
                    .map(([reason, count]) => (
                      <div
                        key={reason}
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <span className="text-sm text-slate-300">
                          {formatReason(reason)}
                        </span>

                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Execution submitted: No</span>

            {generatedAt ? (
              <span>Generated: {generatedAt}</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}