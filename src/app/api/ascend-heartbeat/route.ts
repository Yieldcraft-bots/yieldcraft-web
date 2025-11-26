// src/app/api/ascend-heartbeat/route.ts
// TEMP STUB: disable Ascend Mode C so Vercel can build successfully.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  // Keep the same guard as before.
  if (process.env.BOT_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, reason: "BOT_ENABLED is not true" },
      { status: 403 }
    );
  }

  // Temporary stub response: always HOLD, no action.
  return NextResponse.json({
    ok: true,
    mode: "C",
    should_act: false,
    ascend_decision: "HOLD",
    ascend_mode_tier: "off",
    position_scale: 0,
    trend_bias: "unknown",
    recon: {
      side: "HOLD",
      confidence: 0,
      regime: "disabled",
      source: "ascend_stub",
    },
  });
}
