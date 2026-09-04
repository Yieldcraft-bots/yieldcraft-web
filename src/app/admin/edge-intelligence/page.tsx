import Link from "next/link";

import CandidateTable from "./components/CandidateTable";
import MetricCard from "./components/MetricCard";

import { buildEdgeIntelligenceSnapshot } from "@/lib/edge-intelligence/buildEdgeIntelligenceSnapshot";

export const dynamic = "force-dynamic";

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

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "Unknown";
  }

  return new Date(parsed).toLocaleString();
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function EdgeIntelligencePage() {
  const snapshot = await buildEdgeIntelligenceSnapshot();

  const longCandidates = snapshot.candidates.filter(
    (candidate) => candidate.direction === "LONG"
  ).length;

  const shortCandidates = snapshot.candidates.filter(
    (candidate) => candidate.direction === "SHORT"
  ).length;

  const avoidCandidates = snapshot.candidates.filter(
    (candidate) => candidate.direction === "AVOID"
  ).length;

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Link
              href="/admin"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Mission Control
            </Link>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Edge Intelligence
              </h1>

              <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Read Only
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-zinc-400">
              YieldCraft&apos;s operator cockpit for market truth, candidate
              discovery, realized Pulse performance, and governed edge
              validation across changing market environments.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Edge Decision State
            </div>

            <div className="mt-2 text-xl font-semibold">
              {humanize(snapshot.decisionState)}
            </div>

            <div className="mt-1 text-xs text-zinc-500">
              As of {formatTimestamp(snapshot.asOf)}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Operator Brief
              </div>

              <h2 className="mt-3 text-2xl font-semibold">
                {snapshot.operatorBrief.headline}
              </h2>

              <p className="mt-3 leading-7 text-zinc-400">
                {snapshot.operatorBrief.summary}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm">
              <div className="text-zinc-500">Recommended action</div>
              <div className="mt-1 max-w-sm font-medium text-zinc-200">
                {snapshot.operatorBrief.recommendedAction}
              </div>
            </div>
          </div>

          {(snapshot.operatorBrief.evidence.length > 0 ||
            snapshot.operatorBrief.cautions.length > 0) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Evidence
                </div>

                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                  {snapshot.operatorBrief.evidence.map((item) => (
                    <div key={item}>• {item}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Cautions
                </div>

                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                  {snapshot.operatorBrief.cautions.length > 0 ? (
                    snapshot.operatorBrief.cautions.map((item) => (
                      <div key={item}>• {item}</div>
                    ))
                  ) : (
                    <div className="text-zinc-500">
                      No additional cautions reported.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <section className="mt-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Market Truth
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Regime"
              value={snapshot.marketTruth.regime ?? "UNKNOWN"}
              detail={snapshot.marketTruth.productId ?? "Product unavailable"}
            />

            <MetricCard
              label="Structure"
              value={snapshot.marketTruth.structure ?? "UNKNOWN"}
              detail={`Freshness: ${snapshot.marketTruth.freshness}`}
            />

            <MetricCard
              label="Volatility"
              value={formatNumber(
                snapshot.marketTruth.volatilityBps,
                2,
                " bps"
              )}
            />

            <MetricCard
              label="15m Outcome"
              value={formatNumber(
                snapshot.marketTruth.latestOutcome15mBps,
                2,
                " bps"
              )}
            />

            <MetricCard
              label="Observed"
              value={snapshot.marketTruth.freshness}
              detail={formatTimestamp(snapshot.marketTruth.observedAt)}
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Edge Trend
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Current Daily Edge"
              value={formatNumber(
                snapshot.edgeTrend.todayEdgeBps,
                2,
                " bps"
              )}
            />

            <MetricCard
              label="7-Row Edge"
              value={formatNumber(snapshot.edgeTrend.edge7dBps, 2, " bps")}
            />

            <MetricCard
              label="14-Row Edge"
              value={formatNumber(snapshot.edgeTrend.edge14dBps, 2, " bps")}
            />

            <MetricCard
              label="45-Day Edge"
              value={formatNumber(snapshot.edgeTrend.edge45dBps, 2, " bps")}
            />

            <MetricCard
              label="Trend"
              value={snapshot.edgeTrend.direction}
              detail={`${snapshot.edgeTrend.sampleSize ?? 0} closed trades`}
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Directional Discovery
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Long Candidates"
              value={String(longCandidates)}
              detail="Measured long-side research candidates."
            />

            <MetricCard
              label="Short Candidates"
              value={String(shortCandidates)}
              detail="Research only. Short execution remains disabled."
            />

            <MetricCard
              label="Avoid / No Trade"
              value={String(avoidCandidates)}
              detail="Capital-protection opportunities."
            />

            <MetricCard
              label="Total Candidates"
              value={String(snapshot.candidates.length)}
              detail="Across available market environments."
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Pulse Reality
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Trades"
              value={String(snapshot.pulsePerformance.trades)}
              detail={`Freshness: ${snapshot.pulsePerformance.freshness}`}
            />

            <MetricCard
              label="Win Rate"
              value={formatNumber(
                snapshot.pulsePerformance.winRatePct,
                1,
                "%"
              )}
            />

            <MetricCard
              label="Edge / Trade"
              value={formatNumber(
                snapshot.pulsePerformance.avgEdgeBps,
                2,
                " bps"
              )}
            />

            <MetricCard
              label="Gross PnL"
              value={formatNumber(
                snapshot.pulsePerformance.grossPnlUsd,
                2,
                " USD"
              )}
            />

            <MetricCard
              label="Hard Stops"
              value={
                snapshot.pulsePerformance.hardStops === null
                  ? "—"
                  : String(snapshot.pulsePerformance.hardStops)
              }
            />

            <MetricCard
              label="Trail Stops"
              value={
                snapshot.pulsePerformance.trailStops === null
                  ? "—"
                  : String(snapshot.pulsePerformance.trailStops)
              }
              detail={`Last close: ${formatTimestamp(
                snapshot.pulsePerformance.latestClosedTradeAt
              )}`}
            />
          </div>
        </section>

        <section className="mt-8">
          <CandidateTable candidates={snapshot.candidates} />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Opportunity Utilization
            </div>

            <div className="mt-3 text-xl font-semibold">
              {snapshot.opportunityUtilization.status}
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Suppression attribution and rejected-opportunity forward outcomes
              will populate here as the existing gate telemetry is connected.
              Missing evidence is intentionally not represented as zero.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Risk Evidence
            </div>

            <div className="mt-3 text-xl font-semibold">
              {snapshot.risk.status}
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Drawdown, account-defense state, and additional stop-pressure
              evidence will populate here from existing governed telemetry.
            </p>
          </div>
        </section>

        <div className="mt-8 rounded-2xl border border-amber-950 bg-amber-950/10 p-5">
          <div className="text-sm font-semibold text-amber-300">
            Governance Boundary
          </div>

          <p className="mt-2 max-w-5xl text-sm leading-6 text-zinc-400">
            Edge Intelligence may observe, measure, classify, validate, and
            recommend. It cannot place orders, change Pulse policy, allocate
            capital, enable short execution, or automatically promote a
            candidate.
          </p>
        </div>
      </div>
    </main>
  );
}