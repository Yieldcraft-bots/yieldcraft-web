// src/app/api/ascend-heartbeat/route.ts
// Ascend Mode C – Dynamic Hybrid Intelligence (analysis only, no direct trading)

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Recon signal structure (shared shape with pulse).
 */
type ReconSide = "BUY" | "SELL" | "HOLD";

interface ReconSignal {
  side: ReconSide;
  confidence: number;
  regime?: string;
  source: string;
  raw?: any;
}

/**
 * Get Recon signal from URL, or fall back to HOLD if missing/low confidence.
 */
async function getReconSignal(): Promise<ReconSignal> {
  const url = process.env.RECON_SIGNAL_URL;
  const minConf = Number(process.env.RECON_MIN_CONF ?? "0.6");

  if (!url) {
    return {
      side: "HOLD",
      confidence: 0,
      regime: "none",
      source: "missing_url",
    };
  }

  try {
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();

    const sideRaw = String(json.side ?? "").toUpperCase();
    const side: ReconSide =
      sideRaw === "BUY" || sideRaw === "SELL" ? (sideRaw as ReconSide) : "HOLD";

    const confidence = Number(json.confidence ?? 0);

    if (confidence < minConf || side === "HOLD") {
      return {
        side: "HOLD",
        confidence,
        regime: json.regime ?? "unknown",
        source: "low_conf_or_hold",
        raw: json,
      };
    }

    return {
      side,
      confidence,
      regime: json.regime ?? "unknown",
      source: "url",
      raw: json,
    };
  } catch (err) {
    return {
      side: "HOLD",
      confidence: 0,
      regime: "error",
      source: "url_error",
      raw: String(err),
    };
  }
}

/**
 * Light regime parsing to understand trend vs chop.
 */
type TrendBias = "trend_up" | "trend_down" | "chop" | "unknown";

function parseTrendBias(regime?: string): TrendBias {
  if (!regime) return "unknown";
  const r = regime.toLowerCase();

  if (r.includes("trend") && r.includes("up")) return "trend_up";
  if (r.includes("trend") && r.includes("down")) return "trend_down";
  if (r.includes("bull")) return "trend_up";
  if (r.includes("bear")) return "trend_down";
  if (r.includes("range") || r.includes("chop") || r.includes("sideways"))
    return "chop";

  return "unknown";
}

/**
 * Core Mode C logic: conservative in chop/low confidence, aggressive
 * when strong trend + high confidence + direction match.
 */
function computeAscendDecision(recon: ReconSignal) {
  const bias = parseTrendBias(recon.regime);
  const conf = recon.confidence;

  // Default: flat, no scaling.
  let decision: ReconSide = "HOLD";
  let modeTier: "off" | "conservative" | "normal" | "aggressive" = "off";
  let positionScale = 0; // multiplier on base size (0 = no trade, 1 = normal, >1 = larger)

  // No usable signal -> stay flat.
  if (recon.side === "HOLD" || conf <= 0) {
    return {
      decision,
      modeTier,
      positionScale,
      bias,
    };
  }

  // Does the trend bias agree with the Recon side?
  const trendAgrees =
    (bias === "trend_up" && recon.side === "BUY") ||
    (bias === "trend_down" && recon.side === "SELL");

  // --- Mode C tiers ---
  if (!trendAgrees || bias === "chop" || bias === "unknown") {
    // Trend unclear or against us -> stay small or flat.
    if (conf >= 0.65) {
      decision = recon.side;
      modeTier = "conservative";
      positionScale = 0.5; // half size in chop
    } else {
      decision = "HOLD";
      modeTier = "off";
      positionScale = 0;
    }
  } else {
    // Trend agrees with direction.
    if (conf >= 0.85) {
      decision = recon.side;
      modeTier = "aggressive";
      positionScale = 1.5; // 1.5x base size in strong trend
    } else if (conf >= 0.70) {
      decision = recon.side;
      modeTier = "normal";
      positionScale = 1.0; // normal size
    } else if (conf >= 0.60) {
      decision = recon.side;
      modeTier = "conservative";
      positionScale = 0.75; // slightly reduced size
    } else {
      decision = "HOLD";
      modeTier = "off";
      positionScale = 0;
    }
  }

  return {
    decision,
    modeTier,
    positionScale,
    bias,
  };
}

/**
 * POST /api/ascend-heartbeat
 * Ascend returns an "intelligence layer" decision only. No orders.
 */
export async function POST() {
  try {
    if (process.env.BOT_ENABLED !== "true") {
      return NextResponse.json(
        { ok: false, reason: "BOT_ENABLED is not true" },
        { status: 403 }
      );
    }

    // Ascend does not place orders; it only returns guidance that Brain can use.
    const recon = await getReconSignal();
    const hybrid = computeAscendDecision(recon);

    const shouldAct = hybrid.decision !== "HOLD" && hybrid.positionScale > 0;

    return NextResponse.json({
      ok: true,
      mode: "C",
      should_act: shouldAct,
      ascend_decision: hybrid.decision,
      ascend_mode_tier: hybrid.modeTier,
      position_scale: hybrid.positionScale,
      trend_bias: hybrid.bias,
      recon,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
