import type { EdgeCandidate } from "@/lib/edge-intelligence/types";

function formatNumber(
  value: number | null,
  digits = 2,
  suffix = ""
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function directionLabel(candidate: EdgeCandidate): string {
  if (candidate.direction === "SHORT") {
    return "SHORT · RESEARCH";
  }

  return candidate.direction;
}

export default function CandidateTable({
  candidates,
}: {
  candidates: EdgeCandidate[];
}) {
  const rows = candidates.slice(0, 12);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Candidate Promotion Board
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Existing Edge Factory candidates. Read-only operator intelligence.
            </p>
          </div>

          <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            No live actions
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-sm text-zinc-500">
          No candidates are currently available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-black/40 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-4">Signal</th>
                <th className="px-5 py-4">Direction</th>
                <th className="px-5 py-4">Environment</th>
                <th className="px-5 py-4 text-right">Samples</th>
                <th className="px-5 py-4 text-right">Edge</th>
                <th className="px-5 py-4 text-right">Win Rate</th>
                <th className="px-5 py-4">State</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-900">
              {rows.map((candidate) => (
                <tr
                  key={[
                    candidate.productId,
                    candidate.signal,
                    candidate.regime,
                    candidate.structure,
                    candidate.minutes ?? "unknown",
                  ].join("-")}
                  className="text-zinc-300"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">
                      {candidate.signal}
                    </div>

                    <div className="mt-1 text-xs text-zinc-500">
                      {candidate.productId}
                      {candidate.minutes !== null
                        ? ` · ${candidate.minutes}m`
                        : ""}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={
                        candidate.direction === "SHORT"
                          ? "rounded-full border border-amber-900 bg-amber-950/30 px-2.5 py-1 text-xs font-semibold text-amber-300"
                          : candidate.direction === "LONG"
                            ? "rounded-full border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                            : "rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-400"
                      }
                    >
                      {directionLabel(candidate)}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div>{candidate.regime}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {candidate.structure}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums">
                    {candidate.samples}
                  </td>

                  <td className="px-5 py-4 text-right font-medium tabular-nums text-white">
                    {formatNumber(candidate.avgEdgeBps, 2, " bps")}
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums">
                    {formatNumber(candidate.winRatePct, 1, "%")}
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-medium text-white">
                      {candidate.decisionState.replaceAll("_", " ")}
                    </div>

                    {candidate.capability === "RESEARCH_ONLY" ? (
                      <div className="mt-1 text-xs text-amber-400">
                        Execution disabled
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}