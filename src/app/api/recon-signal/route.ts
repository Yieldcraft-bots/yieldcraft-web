// src/app/api/recon-signal/route.ts
// Temporary Recon AI signal endpoint.
// Later we replace this body with real Mile-Ahead AI logic.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // TODO: plug in real AI / regime detection here.
  // For now, return a confident BUY so Pulse can trade.
  return NextResponse.json({
    side: "BUY",          // "BUY", "SELL", or "HOLD"
    confidence: 0.82,     // must be >= RECON_MIN_CONF (0.60) to pass
    regime: "bullish_trending",
    meta: {
      model: "yc-recon-v0-dummy",
      note: "replace with real AI once ready",
    },
  });
}
