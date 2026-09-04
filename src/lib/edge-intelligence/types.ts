export type EdgeDirection = "LONG" | "SHORT" | "AVOID" | "NEUTRAL";

export type EdgeDecisionState =
  | "NO_EDGE"
  | "WATCH"
  | "CANDIDATE"
  | "SHADOW_READY"
  | "PROMOTION_READY"
  | "DEGRADING"
  | "STALE"
  | "UNKNOWN";

export type TelemetryFreshnessState =
  | "FRESH"
  | "AGING"
  | "STALE"
  | "UNKNOWN";

export type EdgeTrendDirection =
  | "IMPROVING"
  | "STABLE"
  | "WEAKENING"
  | "MIXED"
  | "UNKNOWN";

export type CandidateCapability =
  | "SUPPORTED"
  | "RESEARCH_ONLY"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN";

export type MarketTruthSnapshot = {
  productId: string | null;
  regime: string | null;
  structure: string | null;
  volatilityBps: number | null;
  latestOutcome15mBps: number | null;
  observedAt: string | null;
  freshness: TelemetryFreshnessState;
};

export type EdgeTrendSnapshot = {
  todayEdgeBps: number | null;
  edge7dBps: number | null;
  edge14dBps: number | null;
  edge45dBps: number | null;
  direction: EdgeTrendDirection;
  sampleSize: number | null;
};

export type EdgeCandidate = {
  productId: string;
  signal: string;
  direction: EdgeDirection;
  regime: string;
  structure: string;
  minutes: number | null;
  samples: number;
  avgEdgeBps: number | null;
  winRatePct: number | null;
  promotionStatus: string | null;
  decisionState: EdgeDecisionState;
  capability: CandidateCapability;
  notes: string[];
};

export type PulsePerformanceSnapshot = {
  trades: number;
  wins: number | null;
  losses: number | null;
  winRatePct: number | null;
  avgEdgeBps: number | null;
  grossPnlUsd: number | null;
  avgWinBps: number | null;
  avgLossBps: number | null;
  hardStops: number | null;
  trailStops: number | null;
  latestClosedTradeAt: string | null;
  freshness: TelemetryFreshnessState;
};

export type OpportunityUtilizationSnapshot = {
  observed: number | null;
  accepted: number | null;
  suppressed: number | null;
  suppressedPositiveOutcomes: number | null;
  suppressedNegativeOutcomes: number | null;
  estimatedSuppressedEdgeBps: number | null;
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

export type RiskSnapshot = {
  maxDrawdownPct: number | null;
  defenseAccounts: number | null;
  hardStopPct: number | null;
  trailStopPct: number | null;
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

export type EdgeOperatorBrief = {
  headline: string;
  summary: string;
  evidence: string[];
  cautions: string[];
  recommendedAction: string;
};

export type EdgeIntelligenceSnapshot = {
  ok: boolean;
  asOf: string;
  readOnly: true;
  executionChangesAllowed: false;
  shortExecutionEnabled: false;

  decisionState: EdgeDecisionState;

  marketTruth: MarketTruthSnapshot;
  edgeTrend: EdgeTrendSnapshot;

  candidates: EdgeCandidate[];

  pulsePerformance: PulsePerformanceSnapshot;

  opportunityUtilization: OpportunityUtilizationSnapshot;

  risk: RiskSnapshot;

  operatorBrief: EdgeOperatorBrief;

  sources: {
    marketTruth: string[];
    candidates: string[];
    pulsePerformance: string[];
    opportunityUtilization: string[];
    risk: string[];
  };
};