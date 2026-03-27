import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type OutcomeRow = {
  regime: string | null;
  status: string | null;
  structure: string | null;
  horizon_minutes: number | null;
  volatility_bps: number | null;
  move_bps: number | null;
  scan_created_at: string | null;
};

type BucketSummary = {
  label: string;
  trades: number;
  avg_move_bps: number;
  win_rate: number;
};

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function winRate(values: number[]) {
  if (!values.length) return 0;
  const wins = values.filter((v) => v > 0).length;
  return (wins / values.length) * 100;
}

function makeSummary(label: string, values: number[]): BucketSummary {
  return {
    label,
    trades: values.length,
    avg_move_bps: round(avg(values)),
    win_rate: round(winRate(values)),
  };
}

function bucketVolatility(vol: number | null) {
  if (vol === null || !Number.isFinite(vol)) return "unknown";
  if (vol < 5) return "<5";
  if (vol < 10) return "5-10";
  if (vol < 15) return "10-15";
  if (vol < 20) return "15-20";
  return "20+";
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("edge_outcomes")
      .select(
        "regime, status, structure, horizon_minutes, volatility_bps, move_bps, scan_created_at"
      )
      .order("scan_created_at", { ascending: false })
      .limit(5000);

    if (error) {
      throw new Error(`Failed to read edge_outcomes: ${error.message}`);
    }

    const rows = ((data ?? []) as OutcomeRow[])
      .map((row) => ({
        regime: row.regime ?? "UNKNOWN",
        status: row.status ?? "unknown",
        structure: row.structure ?? "unknown",
        horizon_minutes: row.horizon_minutes ?? 0,
        volatility_bps: safeNumber(row.volatility_bps),
        move_bps: safeNumber(row.move_bps),
        scan_created_at: row.scan_created_at,
      }))
      .filter((row) => row.move_bps !== null) as Array<{
      regime: string;
      status: string;
      structure: string;
      horizon_minutes: number;
      volatility_bps: number | null;
      move_bps: number;
      scan_created_at: string | null;
    }>;

    const allMoves = rows.map((r) => r.move_bps);

    const byRegimeMap = new Map<string, number[]>();
    const byStatusMap = new Map<string, number[]>();
    const byStructureMap = new Map<string, number[]>();
    const byHorizonMap = new Map<string, number[]>();
    const byVolatilityMap = new Map<string, number[]>();

    for (const row of rows) {
      const regimeKey = row.regime || "UNKNOWN";
      const statusKey = row.status || "unknown";
      const structureKey = row.structure || "unknown";
      const horizonKey = `${row.horizon_minutes}m`;
      const volatilityKey = bucketVolatility(row.volatility_bps);

      if (!byRegimeMap.has(regimeKey)) byRegimeMap.set(regimeKey, []);
      if (!byStatusMap.has(statusKey)) byStatusMap.set(statusKey, []);
      if (!byStructureMap.has(structureKey)) byStructureMap.set(structureKey, []);
      if (!byHorizonMap.has(horizonKey)) byHorizonMap.set(horizonKey, []);
      if (!byVolatilityMap.has(volatilityKey)) byVolatilityMap.set(volatilityKey, []);

      byRegimeMap.get(regimeKey)!.push(row.move_bps);
      byStatusMap.get(statusKey)!.push(row.move_bps);
      byStructureMap.get(structureKey)!.push(row.move_bps);
      byHorizonMap.get(horizonKey)!.push(row.move_bps);
      byVolatilityMap.get(volatilityKey)!.push(row.move_bps);
    }

    const byRegime = Array.from(byRegimeMap.entries())
      .map(([label, values]) => makeSummary(label, values))
      .sort((a, b) => b.avg_move_bps - a.avg_move_bps);

    const byStatus = Array.from(byStatusMap.entries())
      .map(([label, values]) => makeSummary(label, values))
      .sort((a, b) => b.avg_move_bps - a.avg_move_bps);

    const byStructure = Array.from(byStructureMap.entries())
      .map(([label, values]) => makeSummary(label, values))
      .sort((a, b) => b.avg_move_bps - a.avg_move_bps);

    const byHorizon = Array.from(byHorizonMap.entries())
      .map(([label, values]) => makeSummary(label, values))
      .sort((a, b) => {
        const aNum = Number(a.label.replace("m", ""));
        const bNum = Number(b.label.replace("m", ""));
        return aNum - bNum;
      });

    const volatilityOrder = ["<5", "5-10", "10-15", "15-20", "20+", "unknown"];
    const byVolatility = Array.from(byVolatilityMap.entries())
      .map(([label, values]) => makeSummary(label, values))
      .sort(
        (a, b) =>
          volatilityOrder.indexOf(a.label) - volatilityOrder.indexOf(b.label)
      );

    const latestScanAt = rows[0]?.scan_created_at ?? null;

    return NextResponse.json({
      ok: true,
      totals: {
        outcomes: rows.length,
        avg_move_bps: round(avg(allMoves)),
        win_rate: round(winRate(allMoves)),
        latest_scan_at: latestScanAt,
      },
      by_regime: byRegime,
      by_status: byStatus,
      by_structure: byStructure,
      by_horizon: byHorizon,
      by_volatility: byVolatility,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in edge summary.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}