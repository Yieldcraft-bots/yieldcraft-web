import "server-only";

import type {
  EdgeDecisionState,
  EdgeIntelligenceSnapshot,
  EdgeOperatorBrief,
} from "./types";

import { readMarketTruth } from "./marketTruthReader";
import { readEdgeCandidates } from "./candidateReader";
import { readPulsePerformance } from "./pulsePerformanceReader";

function deriveDecisionState(
  marketFreshness: string,
  candidates: Awaited<ReturnType<typeof readEdgeCandidates>>
): EdgeDecisionState {
  if (marketFreshness === "STALE") {
    return "STALE";
  }

  if (marketFreshness === "UNKNOWN") {
    return "UNKNOWN";
  }

  if (candidates.some((candidate) => candidate.decisionState === "DEGRADING")) {
    return "DEGRADING";
  }

  if (
    candidates.some(
      (candidate) => candidate.decisionState === "PROMOTION_READY"
    )
  ) {
    return "PROMOTION_READY";
  }

  if (
    candidates.some((candidate) => candidate.decisionState === "SHADOW_READY")
  ) {
    return "SHADOW_READY";
  }

  if (candidates.some((candidate) => candidate.decisionState === "CANDIDATE")) {
    return "CANDIDATE";
  }

  if (candidates.some((candidate) => candidate.decisionState === "WATCH")) {
    return "WATCH";
  }

  if (candidates.length > 0) {
    return "WATCH";
  }

  return "NO_EDGE";
}

function buildOperatorBrief(params: {
  decisionState: EdgeDecisionState;
  candidates: Awaited<ReturnType<typeof readEdgeCandidates>>;
  marketTruth: Awaited<ReturnType<typeof readMarketTruth>>;
  pulsePerformance: Awaited<ReturnType<typeof readPulsePerformance>>["performance"];
}): EdgeOperatorBrief {
  const { decisionState, candidates, marketTruth, pulsePerformance } = params;

  const strongestCandidate =
    candidates
      .filter((candidate) => candidate.avgEdgeBps !== null)
      .sort(
        (a, b) =>
          (b.avgEdgeBps ?? Number.NEGATIVE_INFINITY) -
          (a.avgEdgeBps ?? Number.NEGATIVE_INFINITY)
      )[0] ?? null;

  const evidence: string[] = [];
  const cautions: string[] = [];

  if (marketTruth.regime) {
    evidence.push(`Current regime: ${marketTruth.regime}.`);
  }

  if (marketTruth.structure) {
    evidence.push(`Current structure: ${marketTruth.structure}.`);
  }

  if (strongestCandidate) {
    evidence.push(
      `Strongest measured candidate: ${strongestCandidate.signal} in ` +
        `${strongestCandidate.regime}/${strongestCandidate.structure} with ` +
        `${strongestCandidate.samples} samples and ` +
        `${
          strongestCandidate.avgEdgeBps === null
            ? "unknown"
            : strongestCandidate.avgEdgeBps.toFixed(2)
        } bps average edge.`
    );
  }

  if (pulsePerformance.avgEdgeBps !== null) {
    evidence.push(
      `Realized 45-day Pulse edge: ${pulsePerformance.avgEdgeBps.toFixed(
        2
      )} bps/trade.`
    );
  }

  if (marketTruth.freshness !== "FRESH") {
    cautions.push(
      `Market telemetry freshness is ${marketTruth.freshness.toLowerCase()}.`
    );
  }

  if (pulsePerformance.freshness !== "FRESH") {
    cautions.push(
      `Completed-trade telemetry freshness is ${pulsePerformance.freshness.toLowerCase()}.`
    );
  }

  const researchOnlyShort = candidates.some(
    (candidate) =>
      candidate.direction === "SHORT" &&
      candidate.capability === "RESEARCH_ONLY"
  );

  if (researchOnlyShort) {
    cautions.push(
      "Short-side candidates are research-only and cannot be executed by this system."
    );
  }

  let headline = "No validated edge currently requires operator action.";
  let summary =
    "Continue observing current market and candidate telemetry. No execution changes are authorized.";
  let recommendedAction =
    "Continue observation. Do not modify live Pulse policy from this console.";

  if (decisionState === "WATCH") {
    headline = "Edge conditions are worth watching.";
    summary =
      "Measured evidence exists, but current evidence does not justify promotion.";
    recommendedAction =
      "Review candidate evidence and continue validation. Do not promote.";
  }

  if (decisionState === "CANDIDATE") {
    headline = "A measurable edge candidate is forming.";
    summary =
      "One or more candidates have enough evidence to deserve structured validation.";
    recommendedAction =
      "Review sample quality, regime stability, suppression behavior, and forward outcomes.";
  }

  if (decisionState === "SHADOW_READY") {
    headline = "A candidate may be ready for shadow validation.";
    summary =
      "Evidence has advanced beyond simple observation, but live execution is still not authorized.";
    recommendedAction =
      "Review shadow-readiness evidence and define explicit success and rollback criteria.";
  }

  if (decisionState === "PROMOTION_READY") {
    headline = "A candidate is signaling promotion readiness.";
    summary =
      "Telemetry indicates a candidate may qualify for governed implementation review.";
    recommendedAction =
      "Conduct human governance review before any Pulse implementation. No automatic promotion is allowed.";
  }

  if (decisionState === "DEGRADING") {
    headline = "Previously measured edge may be degrading.";
    summary =
      "Evidence suggests deterioration and deserves operator attention.";
    recommendedAction =
      "Review decay, regime transition, realized performance, and rollback criteria.";
  }

  if (decisionState === "STALE" || decisionState === "UNKNOWN") {
    headline = "Current edge state cannot be trusted yet.";
    summary =
      "Telemetry freshness or availability is insufficient for a confident decision.";
    recommendedAction =
      "Restore or verify telemetry before interpreting current edge conditions.";
  }

  return {
    headline,
    summary,
    evidence,
    cautions,
    recommendedAction,
  };
}

export async function buildEdgeIntelligenceSnapshot(): Promise<EdgeIntelligenceSnapshot> {
  const [marketTruth, candidates, pulse] = await Promise.all([
    readMarketTruth(),
    readEdgeCandidates(),
    readPulsePerformance(),
  ]);

  const decisionState = deriveDecisionState(
    marketTruth.freshness,
    candidates
  );

  return {
    ok: true,
    asOf: new Date().toISOString(),

    readOnly: true,
    executionChangesAllowed: false,
    shortExecutionEnabled: false,

    decisionState,

    marketTruth,
    edgeTrend: pulse.trend,

    candidates,

    pulsePerformance: pulse.performance,

    opportunityUtilization: {
      observed: null,
      accepted: null,
      suppressed: null,
      suppressedPositiveOutcomes: null,
      suppressedNegativeOutcomes: null,
      estimatedSuppressedEdgeBps: null,
      status: "UNAVAILABLE",
    },

    risk: {
      maxDrawdownPct: null,
      defenseAccounts: null,
      hardStopPct: null,
      trailStopPct: null,
      status: "UNAVAILABLE",
    },

    operatorBrief: buildOperatorBrief({
      decisionState,
      candidates,
      marketTruth,
      pulsePerformance: pulse.performance,
    }),

    sources: {
      marketTruth: ["edge_outcomes"],
      candidates: ["edge_promotion_board_v1"],
      pulsePerformance: ["trade_logs"],
      opportunityUtilization: [],
      risk: [],
    },
  };
}