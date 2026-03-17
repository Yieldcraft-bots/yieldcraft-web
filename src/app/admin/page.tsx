"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

type StrategyIntelResp =
  | {
      ok: true;
      decisionsAnalyzed: number;
      averages: {
        avgOutcome30mBps: number;
        avgOutcome60mBps: number;
      };
      entry: {
        total: number;
        allowed: number;
        blocked: number;
        allowedPct: number;
        blockedPct: number;
        wins: number;
        losses: number;
        missedWins: number;
        goodBlocks: number;
        winRatePct: number;
        lossRatePct: number;
      };
      exit: {
        holdCount: number;
        exitSignalCount: number;
        goodHolds: number;
        badHolds: number;
        earlyExits: number;
        goodExits: number;
        holdQualityPct: number;
        exitTimingQualityPct: number;
      };
      confidenceSummary?: Array<{
        bucket: string;
        total: number;
        wins: number;
        losses: number;
        winRatePct: number;
        avg30mBps: number;
      }>;
      regimeSummary?: Array<{
        regime: string;
        total: number;
        wins: number;
        losses: number;
        missedWins: number;
        goodBlocks: number;
        goodHolds: number;
        badHolds: number;
        earlyExits: number;
        goodExits: number;
        entryWinRatePct: number;
      }>;
      meta?: {
        avgLossBps?: number;
        avgHoldMinutes?: number;
        note?: string;
      };
      corefund?: {
        symbol?: string;
        trades?: number;
        wins?: number;
        losses?: number;
        avgEdgeBps?: number;
        avgWinBps?: number;
        avgLossBps?: number;
        avgHoldMinutes?: number;
        winRatePct?: number;
      };
      network?: {
        symbol?: string;
        trades?: number;
        wins?: number;
        losses?: number;
        avgEdgeBps?: number;
        avgWinBps?: number;
        avgLossBps?: number;
        avgHoldMinutes?: number;
        winRatePct?: number;
      };
      source?: {
        coreFund?: string;
        network?: string;
      };
    }
  | { ok: false; error?: string; [k: string]: any };

type StrategyAdjustmentsResp =
  | {
      ok: true;
      status: string;
      stats: {
        trades: number;
        wins: number;
        losses: number;
        winRate: number;
        avgWinBps: number;
        avgLossBps: number;
        edgePerTradeBps?: number;
      };
      current: {
        profitTargetBps: number;
        trailOffsetBps: number;
        reconConfidence: number;
      };
      recommended: {
        profitTargetBps: number;
        trailOffsetBps: number;
        reconConfidence: number;
      };
      meta?: {
        advisoryOnly?: boolean;
        basis?: string;
        lookbackDays?: number;
        since?: string;
        sampleConfidence?: string;
        avgHoldMinutes?: number;
        notes?: string[];
      };
    }
  | { ok: false; error?: string; [k: string]: any };

type EdgeTestResp =
  | {
      ok: true;
      status: string;
      sampleSize: number;
      wins: number;
      losses: number;
      winRate: number | null;
      avgWinBps: number;
      avgLossBps: number;
      edgePerTradeBps: number;
      totalPnL: number;
    }
  | { ok: false; error?: string; [k: string]: any };

type DecisionRow = {
  id: string;
  created_at: string;
  action_phase: string | null;
  decision_mode: string | null;
  decision_reason: string | null;
  market_regime: string | null;
  recon_confidence: number | null;
  spot_price: number | null;
  meta?: any;
};

type ConfidenceBucket = {
  bucket: string;
  total: number;
  wins: number;
  losses: number;
  winRatePct: number;
  avg30mBps: number;
};

type RegimeBucket = {
  regime: string;
  total: number;
  wins: number;
  losses: number;
  missedWins: number;
  goodBlocks: number;
  goodHolds: number;
  badHolds: number;
  earlyExits: number;
  goodExits: number;
  entryWinRatePct: number;
};

type EdgeHeatmapRow = {
  regime: string;
  confidence_bucket: string;
  trades: number;
  avg_edge_bps: number;
  win_rate_pct: number;
};

type EdgeHeatmapResp =
  | { ok: true; data: EdgeHeatmapRow[] }
  | { ok: false; error?: string; [k: string]: any };

type Tone = "green" | "yellow" | "red" | "gray";

function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toFixed(2)}`;
}

function pct(n: any, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function bps(n: any, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)} bps`;
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "green":
      return {
        pill: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
        card: "bg-emerald-500/10 ring-1 ring-emerald-500/25",
        value: "text-emerald-300",
        sub: "text-emerald-200/70",
      };
    case "yellow":
      return {
        pill: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
        card: "bg-amber-500/10 ring-1 ring-amber-500/25",
        value: "text-amber-200",
        sub: "text-amber-100/70",
      };
    case "red":
      return {
        pill: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30",
        card: "bg-rose-500/10 ring-1 ring-rose-500/25",
        value: "text-rose-200",
        sub: "text-rose-100/70",
      };
    default:
      return {
        pill: "bg-white/5 text-white/70 ring-1 ring-white/10",
        card: "bg-white/5 ring-1 ring-white/10",
        value: "text-white",
        sub: "text-white/45",
      };
  }
}

function pnlTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  if (n < 0) return "red";
  return "gray";
}

function edgeTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 15) return "green";
  if (n > 5) return "yellow";
  if (n > 0) return "yellow";
  return "red";
}

function entryQualityTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n >= 70) return "green";
  if (n >= 50) return "yellow";
  return "red";
}

function exitEfficiencyTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n >= 70) return "green";
  if (n >= 40) return "yellow";
  return "red";
}

function winRateTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n >= 55) return "green";
  if (n >= 40) return "yellow";
  return "red";
}

function drawdownTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n <= 5) return "green";
  if (n <= 10) return "yellow";
  return "red";
}

function avgWinTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  return "red";
}

function avgLossTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n < 0) return "red";
  if (n === 0) return "gray";
  return "yellow";
}

function suggestionTone(current: any, recommended: any): Tone {
  const c = Number(current);
  const r = Number(recommended);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return "gray";
  if (r === c) return "gray";
  if (r < c) return "yellow";
  return "green";
}

function regimeTone(regime: string | null | undefined): Tone {
  const r = String(regime || "").toLowerCase();
  if (!r) return "gray";
  if (r.includes("trend")) return "green";
  if (r.includes("volatile")) return "yellow";
  if (r.includes("range") || r.includes("chop")) return "yellow";
  if (r.includes("low")) return "red";
  return "gray";
}

function decisionTone(mode: string | null | undefined): Tone {
  const m = String(mode || "").toLowerCase();
  if (!m) return "gray";
  if (m.includes("allowed") || m.includes("hold")) return "green";
  if (m.includes("blocked")) return "yellow";
  if (m.includes("exit")) return "red";
  return "gray";
}

function entryGateTone(allowed: boolean | null): Tone {
  if (allowed === null) return "gray";
  return allowed ? "green" : "red";
}

function confidenceTone(v: number | null | undefined): Tone {
  if (v == null || !Number.isFinite(v)) return "gray";
  if (v >= 0.72) return "green";
  if (v >= 0.68) return "yellow";
  return "red";
}

function heatCellTone(row: EdgeHeatmapRow): Tone {
  const trades = Number(row.trades);
  const edge = Number(row.avg_edge_bps);

  if (!Number.isFinite(edge)) return "gray";
  if (trades < 2) return "gray";
  if (edge > 10) return "green";
  if (edge > 0) return "yellow";
  return "red";
}

function confidenceOrder(bucket: string) {
  if (bucket === "0.68-0.72") return 0;
  if (bucket === "0.72-0.80") return 1;
  if (bucket === "0.80+") return 2;
  if (bucket === "unknown") return 3;
  return 99;
}

function regimeOrder(regime: string) {
  const r = String(regime || "").toUpperCase();
  if (r === "TRENDING") return 0;
  if (r === "RANGING") return 1;
  if (r === "VOLATILE") return 2;
  if (r === "LOW_LIQUIDITY") return 3;
  if (r === "UNKNOWN") return 4;
  return 99;
}

function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  const cls = useMemo(() => toneClasses(tone).pill, [tone]);

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "gray",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const cls = toneClasses(tone);

  return (
    <div className={`rounded-2xl p-5 ${cls.card}`}>
      <div className="text-xs text-white/60">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${cls.value}`}>
        {value}
      </div>
      {sub ? <div className={`mt-2 text-xs ${cls.sub}`}>{sub}</div> : null}
    </div>
  );
}

function compactDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Admin() {
  const router = useRouter();

  const [pulse, setPulse] = useState<any>(null);
  const [inst, setInst] = useState<any>(null);
  const [strategyIntel, setStrategyIntel] = useState<StrategyIntelResp | null>(null);
  const [strategyAdjustments, setStrategyAdjustments] =
    useState<StrategyAdjustmentsResp | null>(null);
  const [edgeTest, setEdgeTest] = useState<EdgeTestResp | null>(null);
  const [decisionStream, setDecisionStream] = useState<DecisionRow[]>([]);
  const [edgeHeatmap, setEdgeHeatmap] = useState<EdgeHeatmapRow[]>([]);
  const [ts, setTs] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!mounted) return;

      if (!user || user.id !== ADMIN_USER_ID) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    checkAdmin();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function refreshAll() {
    try {
      const p = await fetch("/api/pulse-stats", { cache: "no-store" });
      const pJson = await p.json();
      setPulse(pJson);
    } catch {
      // ignore
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;

      if (token) {
        const r = await fetch("/api/admin/institutional-snapshot", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const j = await r.json();
        setInst(j);
      }
    } catch {
      // ignore
    }

    try {
      const strategyRes = await fetch("/api/strategy-intelligence", {
        cache: "no-store",
      });
      const strategyJson = await strategyRes.json();
      setStrategyIntel(strategyJson);
    } catch {
      // ignore
    }

    try {
      const adjustmentsRes = await fetch("/api/strategy-adjustments", {
        cache: "no-store",
      });
      const adjustmentsJson = await adjustmentsRes.json();
      setStrategyAdjustments(adjustmentsJson);
    } catch {
      // ignore
    }

    try {
      const edgeRes = await fetch("/api/edge-test", {
        cache: "no-store",
      });
      const edgeJson = await edgeRes.json();
      setEdgeTest(edgeJson);
    } catch {
      // ignore
    }

    try {
      const heatmapRes = await fetch("/api/edge-heatmap", {
        cache: "no-store",
      });
      const heatmapJson: EdgeHeatmapResp = await heatmapRes.json();
      if (heatmapJson?.ok && Array.isArray(heatmapJson.data)) {
        setEdgeHeatmap(heatmapJson.data);
      } else {
        setEdgeHeatmap([]);
      }
    } catch {
      setEdgeHeatmap([]);
    }

    try {
      const { data } = await supabase
        .from("strategy_decisions")
        .select(
          "id, created_at, action_phase, decision_mode, decision_reason, market_regime, recon_confidence, spot_price, meta"
        )
        .order("created_at", { ascending: false })
        .limit(12);

      setDecisionStream(Array.isArray(data) ? (data as DecisionRow[]) : []);
    } catch {
      setDecisionStream([]);
    }

    setTs(Date.now());
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
  }, []);

  const pStats = pulse?.stats;
  const instData = inst?.institutional?.data;
  const cfSnap = inst?.corefund?.snapshot;

  const netTone = pnlTone(pStats?.netPnL);

  const strategyEdgeValue =
    strategyIntel && strategyIntel.ok
      ? strategyIntel.averages.avgOutcome30mBps
      : null;

  const strategyTradesAnalyzed =
    strategyIntel && strategyIntel.ok
      ? strategyIntel.decisionsAnalyzed
      : null;

  const strategyWins =
    strategyIntel && strategyIntel.ok ? strategyIntel.entry.wins : null;

  const strategyLosses =
    strategyIntel && strategyIntel.ok ? strategyIntel.entry.losses : null;

  const strategyEntryQuality =
    strategyIntel && strategyIntel.ok ? strategyIntel.entry.winRatePct : null;

  const strategyExitEfficiency =
    strategyIntel && strategyIntel.ok
      ? strategyIntel.exit.holdQualityPct
      : null;

  const strategyAvgWin =
    strategyIntel && strategyIntel.ok
      ? strategyIntel.averages.avgOutcome60mBps
      : null;

  const strategyAvgLoss =
    strategyIntel && strategyIntel.ok && strategyIntel.meta?.avgLossBps != null
      ? -Math.abs(Number(strategyIntel.meta.avgLossBps))
      : null;

  const topEdgeTone: Tone =
    edgeTest && edgeTest.ok
      ? edgeTone(edgeTest.edgePerTradeBps)
      : edgeTone(strategyEdgeValue);

  const winRatePct =
    pStats && pStats.winRate != null ? Number(pStats.winRate) * 100 : null;

  const pulseWinRateTone = winRateTone(winRatePct);
  const coreFundDdTone = drawdownTone(cfSnap?.dd_pct_portfolio);

  const strategyEdgeToneValue: Tone = edgeTone(strategyEdgeValue);
  const strategyEntryTone: Tone = entryQualityTone(strategyEntryQuality);
  const strategyExitTone: Tone = exitEfficiencyTone(strategyExitEfficiency);
  const strategyAvgWinToneValue: Tone = avgWinTone(strategyAvgWin);
  const strategyAvgLossToneValue: Tone = avgLossTone(strategyAvgLoss);

  const recommendedProfitTone: Tone =
    strategyAdjustments && strategyAdjustments.ok
      ? suggestionTone(
          strategyAdjustments.current.profitTargetBps,
          strategyAdjustments.recommended.profitTargetBps
        )
      : "gray";

  const recommendedTrailTone: Tone =
    strategyAdjustments && strategyAdjustments.ok
      ? suggestionTone(
          strategyAdjustments.current.trailOffsetBps,
          strategyAdjustments.recommended.trailOffsetBps
        )
      : "gray";

  const recommendedReconTone: Tone =
    strategyAdjustments && strategyAdjustments.ok
      ? suggestionTone(
          strategyAdjustments.current.reconConfidence,
          strategyAdjustments.recommended.reconConfidence
        )
      : "gray";

  const adjustmentWinRateTone: Tone =
    strategyAdjustments && strategyAdjustments.ok
      ? winRateTone(strategyAdjustments.stats.winRate)
      : "gray";

  const edgeSample =
    edgeTest && edgeTest.ok ? edgeTest.sampleSize : null;

  const edgeWins =
    edgeTest && edgeTest.ok ? edgeTest.wins : null;

  const edgeLosses =
    edgeTest && edgeTest.ok ? edgeTest.losses : null;

  const edgeWinRate =
    edgeTest && edgeTest.ok && edgeTest.winRate != null
      ? Number(edgeTest.winRate) * 100
      : null;

  const edgeAvgWin =
    edgeTest && edgeTest.ok ? edgeTest.avgWinBps : null;

  const edgeAvgLoss =
    edgeTest && edgeTest.ok ? edgeTest.avgLossBps : null;

  const edgePerTrade =
    edgeTest && edgeTest.ok ? edgeTest.edgePerTradeBps : null;

  const edgeTotalPnl =
    edgeTest && edgeTest.ok ? edgeTest.totalPnL : null;

  const edgeSampleTone: Tone =
    edgeSample == null
      ? "gray"
      : edgeSample >= 30
      ? "green"
      : edgeSample >= 10
      ? "yellow"
      : "red";

  const edgeWinRateToneValue: Tone = winRateTone(edgeWinRate);
  const edgePerTradeToneValue: Tone = edgeTone(edgePerTrade);
  const edgeTotalPnlToneValue: Tone = pnlTone(edgeTotalPnl);
  const edgeAvgWinToneValue: Tone = avgWinTone(edgeAvgWin);
  const edgeAvgLossToneValue: Tone = avgLossTone(edgeAvgLoss);

  const confidenceSummary: ConfidenceBucket[] =
    strategyIntel && strategyIntel.ok && Array.isArray(strategyIntel.confidenceSummary)
      ? strategyIntel.confidenceSummary
      : [];

  const regimeSummary: RegimeBucket[] =
    strategyIntel && strategyIntel.ok && Array.isArray(strategyIntel.regimeSummary)
      ? strategyIntel.regimeSummary
      : [];

  const bestConfidenceBucket =
    confidenceSummary.length > 0
      ? [...confidenceSummary].sort((a, b) => b.avg30mBps - a.avg30mBps)[0]
      : null;

  const mostCommonRegime =
    regimeSummary.length > 0
      ? [...regimeSummary].sort((a, b) => b.total - a.total)[0]
      : null;

  const bestRegime =
    regimeSummary.length > 0
      ? [...regimeSummary].sort(
          (a, b) => (b.entryWinRatePct || 0) - (a.entryWinRatePct || 0)
        )[0]
      : null;

  const blockedSignals =
    strategyIntel && strategyIntel.ok ? strategyIntel.entry.blocked : null;
  const allowedSignals =
    strategyIntel && strategyIntel.ok ? strategyIntel.entry.allowed : null;

  const signalHealthTone: Tone =
    blockedSignals != null &&
    allowedSignals != null &&
    blockedSignals > allowedSignals
      ? "yellow"
      : "green";

  const avgHoldMinutes =
    strategyAdjustments &&
    strategyAdjustments.ok &&
    strategyAdjustments.meta?.avgHoldMinutes != null
      ? Number(strategyAdjustments.meta.avgHoldMinutes)
      : strategyIntel &&
        strategyIntel.ok &&
        strategyIntel.meta?.avgHoldMinutes != null
      ? Number(strategyIntel.meta.avgHoldMinutes)
      : null;

  const latestDecision = decisionStream.length ? decisionStream[0] : null;
  const latestMeta = latestDecision?.meta || {};
  const latestExitDecision = latestMeta?.exitDecision || null;
  const latestReconReason =
    latestMeta?.reconReason ||
    latestDecision?.decision_reason ||
    "—";

  const currentMarketRegime =
    latestDecision?.market_regime ||
    latestExitDecision?.regime ||
    mostCommonRegime?.regime ||
    "—";

  const currentReconConfidence =
    latestDecision?.recon_confidence != null
      ? Number(latestDecision.recon_confidence)
      : null;

  const currentEntryAllowed =
    latestMeta?.entry_allow ??
    latestMeta?.entryPlan?.allowEntry ??
    null;

  const currentMeasuredVol =
    latestMeta?.measured_vol_bps ??
    latestExitDecision?.measuredVolBps ??
    null;

  const currentExitProfile =
    latestExitDecision?.exitProfile ||
    latestExitDecision?.regime ||
    "—";

  const fallbackBucket =
    currentReconConfidence != null
      ? currentReconConfidence >= 0.83
        ? "0.83+"
        : currentReconConfidence >= 0.76
        ? "0.76-0.82"
        : currentReconConfidence >= 0.72
        ? "0.72-0.75"
        : currentReconConfidence >= 0.68
        ? "0.68-0.71"
        : "<0.68"
      : "—";

  const lastRefresh = new Date(ts).toLocaleTimeString();

  const heatmapBuckets = useMemo(() => {
    const buckets = Array.from(
      new Set(edgeHeatmap.map((r) => String(r.confidence_bucket || "unknown")))
    );
    return buckets.sort((a, b) => confidenceOrder(a) - confidenceOrder(b));
  }, [edgeHeatmap]);

  const heatmapRegimes = useMemo(() => {
    const regimes = Array.from(
      new Set(edgeHeatmap.map((r) => String(r.regime || "UNKNOWN")))
    );
    return regimes.sort((a, b) => regimeOrder(a) - regimeOrder(b));
  }, [edgeHeatmap]);

  const heatmapMap = useMemo(() => {
    const map = new Map<string, EdgeHeatmapRow>();
    edgeHeatmap.forEach((row) => {
      map.set(`${row.regime}__${row.confidence_bucket}`, row);
    });
    return map;
  }, [edgeHeatmap]);

  const bestHeatmapRow = useMemo(() => {
    if (!edgeHeatmap.length) return null;
    return [...edgeHeatmap].sort((a, b) => {
      const aScore = Number(a.avg_edge_bps) * Math.max(Number(a.trades), 1);
      const bScore = Number(b.avg_edge_bps) * Math.max(Number(b.trades), 1);
      return bScore - aScore;
    })[0];
  }, [edgeHeatmap]);

  const worstHeatmapRow = useMemo(() => {
    if (!edgeHeatmap.length) return null;
    return [...edgeHeatmap].sort((a, b) => {
      const aScore = Number(a.avg_edge_bps) * Math.max(Number(a.trades), 1);
      const bScore = Number(b.avg_edge_bps) * Math.max(Number(b.trades), 1);
      return aScore - bScore;
    })[0];
  }, [edgeHeatmap]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-white/50">ADMIN</div>
            <h1 className="text-3xl font-semibold">Mission Control</h1>
            <div className="mt-1 text-xs text-white/45">
              Last refresh: <span className="text-white/70">{lastRefresh}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TonePill label="LIVE EXECUTION" tone="green" />
            <TonePill
              label={`CORE FUND TODAY ${pStats ? money(pStats.netPnL) : "—"}`}
              tone={netTone}
            />
            <TonePill
              label={`EDGE ${
                edgeTest && edgeTest.ok
                  ? bps(edgePerTrade)
                  : strategyIntel && strategyIntel.ok
                  ? bps(strategyEdgeValue)
                  : "—"
              }`}
              tone={topEdgeTone}
            />

            <button
              onClick={refreshAll}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-white/15"
            >
              Refresh
            </button>

            <Link
              href="/admin/investor"
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-indigo-500/30"
            >
              Investor
            </Link>

            <Link
              href="/admin/platform"
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-indigo-500/30"
            >
              Platform
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Pulse</h2>
              <TonePill label="CORE FUND · TODAY" tone="gray" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat label="Trades" value={pStats ? String(pStats.trades) : "—"} />

              <Stat
                label="Win Rate"
                value={
                  pStats && pStats.winRate != null
                    ? `${Math.round(Number(pStats.winRate) * 100)}%`
                    : "—"
                }
                tone={pulseWinRateTone}
              />

              <Stat
                label="Net PNL"
                value={pStats ? money(pStats.netPnL) : "—"}
                tone={netTone}
              />
            </div>
          </section>

          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Platform</h2>
              <TonePill label="NETWORK · 30D SNAPSHOT" tone="gray" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat
                label="Users"
                value={instData ? String(instData.total_users_30d) : "—"}
              />

              <Stat
                label="Trades"
                value={instData ? String(instData.total_trades_30d) : "—"}
              />

              <Stat
                label="Volume"
                value={instData ? money(instData.total_volume_usd_30d) : "—"}
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Stat
                label="CoreFund Peak"
                value={cfSnap ? money(cfSnap.peak_equity_usd) : "—"}
              />

              <Stat
                label="CoreFund Equity"
                value={cfSnap ? money(cfSnap.last_equity_usd) : "—"}
                sub={
                  cfSnap?.dd_pct_portfolio != null
                    ? `DD ${pct(cfSnap.dd_pct_portfolio)}`
                    : undefined
                }
                tone={coreFundDdTone}
              />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Market State</h2>
            <TonePill
              label="LIVE DECISION STATE"
              tone={regimeTone(currentMarketRegime)}
            />
          </div>

          <div className="mt-3 text-sm text-white/60">
            Real-time read of why the system is trading, waiting, or blocking. This is the quickest way to see whether the engine is being smart or something is off.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Regime"
              value={String(currentMarketRegime || "—")}
              tone={regimeTone(currentMarketRegime)}
              sub="From latest decision telemetry"
            />

            <Stat
              label="Recon Confidence"
              value={
                currentReconConfidence != null
                  ? currentReconConfidence.toFixed(2)
                  : "—"
              }
              tone={confidenceTone(currentReconConfidence)}
              sub="Current signal confidence"
            />

            <Stat
              label="Entry Gate"
              value={
                currentEntryAllowed == null
                  ? "—"
                  : currentEntryAllowed
                  ? "ALLOWED"
                  : "BLOCKED"
              }
              tone={entryGateTone(currentEntryAllowed)}
              sub={String(latestReconReason || "—")}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Measured Volatility"
              value={
                currentMeasuredVol != null && Number.isFinite(Number(currentMeasuredVol))
                  ? bps(currentMeasuredVol)
                  : "—"
              }
              tone={
                currentMeasuredVol == null
                  ? "gray"
                  : Number(currentMeasuredVol) >= 20
                  ? "green"
                  : Number(currentMeasuredVol) >= 12
                  ? "yellow"
                  : "red"
              }
              sub="Compared against entry vol gate"
            />

            <Stat
              label="Exit Profile"
              value={String(currentExitProfile || "—")}
              tone={regimeTone(currentExitProfile)}
              sub="Active profile on latest exit logic"
            />

            <Stat
              label="Decision Time"
              value={latestDecision ? compactDate(latestDecision.created_at) : "—"}
              sub="Latest strategy_decisions row"
            />
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Edge Tracker</h2>
            <TonePill
              label={
                edgeTest && edgeTest.ok
                  ? edgeSample != null && edgeSample >= 30
                    ? "STATISTICALLY USEFUL"
                    : edgeSample != null && edgeSample >= 10
                    ? "EARLY SIGNAL"
                    : "LOW SAMPLE"
                  : "EDGE OFFLINE"
              }
              tone={edgeTest && edgeTest.ok ? edgeSampleTone : "gray"}
            />
          </div>

          <div className="mt-3 text-sm text-white/60">
            Core Fund completed-trade truth layer. This is the direct measure of whether your internal account is improving.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Sample Size"
              value={edgeTest && edgeTest.ok ? String(edgeSample) : "—"}
              tone={edgeSampleTone}
              sub="Core Fund completed trades"
            />

            <Stat
              label="Edge / Trade"
              value={edgeTest && edgeTest.ok ? bps(edgePerTrade) : "—"}
              tone={edgePerTradeToneValue}
              sub="Primary profitability metric"
            />

            <Stat
              label="Win Rate"
              value={edgeTest && edgeTest.ok ? pct(edgeWinRate) : "—"}
              tone={edgeWinRateToneValue}
              sub={
                edgeTest && edgeTest.ok
                  ? `${edgeWins} wins / ${edgeLosses} losses`
                  : undefined
              }
            />

            <Stat
              label="Total PNL"
              value={edgeTest && edgeTest.ok ? money(edgeTotalPnl) : "—"}
              tone={edgeTotalPnlToneValue}
              sub="Completed trades only"
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <Stat
              label="Avg Win"
              value={edgeTest && edgeTest.ok ? bps(edgeAvgWin) : "—"}
              tone={edgeAvgWinToneValue}
            />

            <Stat
              label="Avg Loss"
              value={edgeTest && edgeTest.ok ? bps(edgeAvgLoss) : "—"}
              tone={edgeAvgLossToneValue}
            />
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Edge Heatmap</h2>
            <div className="flex flex-wrap items-center gap-2">
              <TonePill
                label={edgeHeatmap.length ? "LIVE EDGE MAP" : "HEATMAP OFFLINE"}
                tone={edgeHeatmap.length ? "green" : "gray"}
              />
              <TonePill label="REGIME × CONFIDENCE" tone="gray" />
            </div>
          </div>

          <div className="mt-3 text-sm text-white/60">
            This is the edge finder. It shows exactly where the system is working and where it is bleeding. Green cells are the pockets to protect and expand. Red cells are where not to trust the engine.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Best Pocket"
              value={
                bestHeatmapRow
                  ? `${bestHeatmapRow.regime} · ${bestHeatmapRow.confidence_bucket}`
                  : "—"
              }
              tone={bestHeatmapRow ? heatCellTone(bestHeatmapRow) : "gray"}
              sub={
                bestHeatmapRow
                  ? `${bps(bestHeatmapRow.avg_edge_bps)} · ${bestHeatmapRow.trades} trades · ${pct(bestHeatmapRow.win_rate_pct)} win rate`
                  : "No heatmap data yet"
              }
            />
            <Stat
              label="Worst Pocket"
              value={
                worstHeatmapRow
                  ? `${worstHeatmapRow.regime} · ${worstHeatmapRow.confidence_bucket}`
                  : "—"
              }
              tone={worstHeatmapRow ? heatCellTone(worstHeatmapRow) : "gray"}
              sub={
                worstHeatmapRow
                  ? `${bps(worstHeatmapRow.avg_edge_bps)} · ${worstHeatmapRow.trades} trades · ${pct(worstHeatmapRow.win_rate_pct)} win rate`
                  : "No heatmap data yet"
              }
            />
            <Stat
              label="Tracked Pockets"
              value={edgeHeatmap.length ? String(edgeHeatmap.length) : "—"}
              tone={edgeHeatmap.length >= 4 ? "green" : edgeHeatmap.length ? "yellow" : "gray"}
              sub="Regime-confidence cells with completed-trade history"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[780px]">
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `180px repeat(${Math.max(heatmapBuckets.length, 1)}, minmax(160px, 1fr))`,
                }}
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-xs uppercase tracking-wide text-white/40">
                  Regime
                </div>

                {heatmapBuckets.length ? (
                  heatmapBuckets.map((bucket) => (
                    <div
                      key={bucket}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-white/40">
                        Confidence
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white/85">{bucket}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/45">
                    No buckets yet
                  </div>
                )}

                {heatmapRegimes.length ? (
                  heatmapRegimes.map((regime) => (
                    <>
                      <div
                        key={`${regime}-label`}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                      >
                        <div className="text-[11px] uppercase tracking-wide text-white/40">
                          Regime
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white/90">{regime}</div>
                      </div>

                      {heatmapBuckets.map((bucket) => {
                        const row = heatmapMap.get(`${regime}__${bucket}`);
                        const tone = row ? heatCellTone(row) : "gray";
                        const cls = toneClasses(tone);

                        return (
                          <div
                            key={`${regime}-${bucket}`}
                            className={`rounded-2xl border p-4 transition hover:scale-[1.01] ${
                              row
                                ? cls.card
                                : "border-white/10 bg-white/[0.03] text-white/35 ring-1 ring-white/10"
                            }`}
                          >
                            {row ? (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-[11px] uppercase tracking-wide text-white/45">
                                    Avg Edge
                                  </div>
                                  <span className={`rounded-full px-2 py-1 text-[10px] ${cls.pill}`}>
                                    {row.trades} trades
                                  </span>
                                </div>

                                <div className={`mt-3 text-3xl font-semibold tracking-tight ${cls.value}`}>
                                  {bps(row.avg_edge_bps)}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                                    <div className="text-[11px] text-white/45">Win Rate</div>
                                    <div className="mt-1 font-semibold text-white/90">
                                      {pct(row.win_rate_pct)}
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                                    <div className="text-[11px] text-white/45">Sample</div>
                                    <div className="mt-1 font-semibold text-white/90">
                                      {row.trades}
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full min-h-[140px] items-center justify-center text-center text-sm text-white/30">
                                No completed-trade data
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/45">
                    Edge heatmap data not available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/45">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Positive pocket
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Marginal / watch
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              Negative pocket
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
              Thin or missing sample
            </span>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Signal Health</h2>
              <TonePill label="CORE FUND + DECISION TELEMETRY" tone={signalHealthTone} />
            </div>

            <div className="mt-3 text-sm text-white/60">
              Snapshot of how the strategy is behaving across Core Fund completed trades and recent decision telemetry.
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Signals Allowed"
                value={allowedSignals != null ? String(allowedSignals) : "—"}
                sub="From Strategy Intelligence"
              />
              <Stat
                label="Signals Blocked"
                value={blockedSignals != null ? String(blockedSignals) : "—"}
                sub="From Strategy Intelligence"
              />
              <Stat
                label="Best Confidence Bucket"
                value={
                  bestConfidenceBucket?.bucket ??
                  fallbackBucket ??
                  "—"
                }
                tone={
                  bestConfidenceBucket
                    ? edgeTone(bestConfidenceBucket.avg30mBps)
                    : confidenceTone(currentReconConfidence)
                }
                sub={
                  bestConfidenceBucket
                    ? `Avg ${bps(bestConfidenceBucket.avg30mBps)}`
                    : currentReconConfidence != null
                    ? `Latest confidence ${currentReconConfidence.toFixed(2)}`
                    : undefined
                }
              />
              <Stat
                label="Avg Hold"
                value={
                  avgHoldMinutes != null && Number.isFinite(avgHoldMinutes)
                    ? `${avgHoldMinutes.toFixed(0)} min`
                    : "—"
                }
                sub="Recent completed trades"
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <Stat
                label="Most Common Regime"
                value={mostCommonRegime?.regime ?? "—"}
                tone={regimeTone(mostCommonRegime?.regime)}
                sub={
                  mostCommonRegime
                    ? `${mostCommonRegime.total} observations`
                    : undefined
                }
              />
              <Stat
                label="Best Regime"
                value={bestRegime?.regime ?? "—"}
                tone={regimeTone(bestRegime?.regime)}
                sub={
                  bestRegime
                    ? `${pct(bestRegime.entryWinRatePct)} entry win rate`
                    : undefined
                }
              />
            </div>
          </section>

          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Decision Stream</h2>
              <TonePill
                label={decisionStream.length ? "LIVE TELEMETRY" : "STREAM OFFLINE"}
                tone={decisionStream.length ? "green" : "gray"}
              />
            </div>

            <div className="mt-3 text-sm text-white/60">
              Latest strategy decisions so one screenshot shows what the system is seeing, allowing, blocking, and exiting.
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-white/10">
              <div className="grid grid-cols-5 gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-xs text-white/50">
                <div>Time</div>
                <div>Phase</div>
                <div>Mode</div>
                <div>Regime</div>
                <div>Confidence</div>
              </div>

              {decisionStream.length ? (
                <div className="divide-y divide-white/10">
                  {decisionStream.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-5 gap-3 px-4 py-3 text-sm"
                    >
                      <div className="text-white/80">{compactDate(row.created_at)}</div>
                      <div className="text-white/80">
                        {row.action_phase || "—"}
                        <div className="mt-1 text-[11px] text-white/45">
                          {row.decision_reason || "—"}
                        </div>
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] ${
                            toneClasses(decisionTone(row.decision_mode)).pill
                          }`}
                        >
                          {row.decision_mode || "—"}
                        </span>
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] ${
                            toneClasses(regimeTone(row.market_regime)).pill
                          }`}
                        >
                          {row.market_regime || "—"}
                        </span>
                      </div>
                      <div className="text-white/80">
                        {row.recon_confidence != null
                          ? Number(row.recon_confidence).toFixed(2)
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-white/45">
                  No recent decision rows available.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Strategy Intelligence</h2>
            <div className="flex flex-wrap items-center gap-2">
              <TonePill
                label={
                  strategyIntel && strategyIntel.ok
                    ? "LEARNING ACTIVE"
                    : "INTEL OFFLINE"
                }
                tone={strategyIntel && strategyIntel.ok ? "green" : "gray"}
              />
              <TonePill label="CORE FUND · COMPLETED TRADES" tone="gray" />
            </div>
          </div>

          <div className="mt-3 text-sm text-white/60">
            Core Fund completed-trade intelligence layer. These numbers should align with the Edge Tracker truth layer, not with the today-only Pulse card.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Trades Analyzed"
              value={
                strategyIntel && strategyIntel.ok
                  ? String(strategyTradesAnalyzed)
                  : "—"
              }
            />

            <Stat
              label="Edge / Trade"
              value={
                strategyIntel && strategyIntel.ok
                  ? bps(strategyEdgeValue)
                  : "—"
              }
              tone={strategyEdgeToneValue}
              sub={
                strategyIntel && strategyIntel.ok
                  ? `Avg win ${bps(strategyIntel.averages.avgOutcome60mBps)}`
                  : undefined
              }
            />

            <Stat
              label="Entry Quality"
              value={
                strategyIntel && strategyIntel.ok
                  ? pct(strategyEntryQuality)
                  : "—"
              }
              tone={strategyEntryTone}
              sub={
                strategyIntel && strategyIntel.ok
                  ? `${strategyIntel.entry.allowed} allowed / ${strategyIntel.entry.blocked} blocked`
                  : undefined
              }
            />

            <Stat
              label="Exit Efficiency"
              value={
                strategyIntel && strategyIntel.ok
                  ? pct(strategyExitEfficiency)
                  : "—"
              }
              tone={strategyExitTone}
              sub={
                strategyIntel && strategyIntel.ok
                  ? `${strategyIntel.exit.goodHolds} good holds / ${strategyIntel.exit.badHolds} bad holds`
                  : undefined
              }
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Wins"
              value={strategyIntel && strategyIntel.ok ? String(strategyWins) : "—"}
            />

            <Stat
              label="Losses"
              value={strategyIntel && strategyIntel.ok ? String(strategyLosses) : "—"}
            />

            <Stat
              label="Avg Win"
              value={strategyIntel && strategyIntel.ok ? bps(strategyAvgWin) : "—"}
              tone={strategyAvgWinToneValue}
              sub="Completed trades"
            />

            <Stat
              label="Avg Loss"
              value={strategyIntel && strategyIntel.ok ? bps(strategyAvgLoss) : "—"}
              tone={strategyAvgLossToneValue}
              sub="Completed trades"
            />
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Strategy Suggestions</h2>
            <div className="flex flex-wrap items-center gap-2">
              <TonePill
                label={
                  strategyAdjustments && strategyAdjustments.ok
                    ? "ADVISORY ONLY"
                    : "SUGGESTIONS OFFLINE"
                }
                tone={strategyAdjustments && strategyAdjustments.ok ? "yellow" : "gray"}
              />
              <TonePill label="NETWORK · COMPLETED TRADES · 7D" tone="gray" />
            </div>
          </div>

          <div className="mt-3 text-sm text-white/60">
            Read-only recommendations based on recent completed trades. Nothing changes automatically.
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Trades Reviewed"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? String(strategyAdjustments.stats.trades)
                  : "—"
              }
            />

            <Stat
              label="Win Rate"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? pct(strategyAdjustments.stats.winRate)
                  : "—"
              }
              tone={adjustmentWinRateTone}
            />

            <Stat
              label="Avg Win"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? bps(strategyAdjustments.stats.avgWinBps)
                  : "—"
              }
              tone={
                strategyAdjustments && strategyAdjustments.ok
                  ? avgWinTone(strategyAdjustments.stats.avgWinBps)
                  : "gray"
              }
            />

            <Stat
              label="Avg Loss"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? bps(-Math.abs(strategyAdjustments.stats.avgLossBps))
                  : "—"
              }
              tone={
                strategyAdjustments && strategyAdjustments.ok
                  ? avgLossTone(-Math.abs(strategyAdjustments.stats.avgLossBps))
                  : "gray"
              }
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-1 xl:grid-cols-3">
            <Stat
              label="Profit Target"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? bps(strategyAdjustments.recommended.profitTargetBps, 0)
                  : "—"
              }
              sub={
                strategyAdjustments && strategyAdjustments.ok
                  ? `Current ${bps(strategyAdjustments.current.profitTargetBps, 0)}`
                  : undefined
              }
              tone={recommendedProfitTone}
            />

            <Stat
              label="Trail Offset"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? bps(strategyAdjustments.recommended.trailOffsetBps, 0)
                  : "—"
              }
              sub={
                strategyAdjustments && strategyAdjustments.ok
                  ? `Current ${bps(strategyAdjustments.current.trailOffsetBps, 0)}`
                  : undefined
              }
              tone={recommendedTrailTone}
            />

            <Stat
              label="Recon Confidence"
              value={
                strategyAdjustments && strategyAdjustments.ok
                  ? strategyAdjustments.recommended.reconConfidence.toFixed(2)
                  : "—"
              }
              sub={
                strategyAdjustments && strategyAdjustments.ok
                  ? `Current ${strategyAdjustments.current.reconConfidence.toFixed(2)}`
                  : undefined
              }
              tone={recommendedReconTone}
            />
          </div>
        </section>
      </div>
    </main>
  );
}