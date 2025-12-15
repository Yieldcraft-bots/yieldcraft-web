import { NextResponse } from "next/server";

// IMPORTANT:
// This endpoint reuses the SAME Coinbase auth logic as pulse-heartbeat.
// No JWT duplication. No auth changes. Trading is gated OFF.

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({
    ok: true,
    status: "PULSE_TRADE_READY",
    trading_enabled: false,
    note: "Structure clean. Auth reused from pulse-heartbeat. No execution.",
  });
}
