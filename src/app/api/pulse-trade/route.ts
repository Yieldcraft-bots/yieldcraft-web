// src/app/api/pulse-trade/route.ts
// SAFE: DRY-RUN order builder + hard execution gate (defaults OFF).
// Adds GET so /api/pulse-trade won't 405.
// NO execution code here.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Hard gate (defaults false)
const EXECUTION_ENABLED = process.env.PULSE_TRADE_EXECUTION_ENABLED === "true";

function jsonError(message: string, extra: Record<string, any> = {}, status = 400) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

type Side = "BUY" | "SELL";

type Body = {
  action?: "dry_run_order";
  product_id?: string;     // e.g. "BTC-USD"
  side?: Side;             // "BUY" | "SELL"
  quote_size?: string;     // BUY uses quote_size
  base_size?: string;      // SELL uses base_size
  client_order_id?: string;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "PULSE_TRADE_READY",
    trading_enabled: EXECUTION_ENABLED,
    note: "GET is alive. Use POST with {action:'dry_run_order'} to build an order payload. No execution.",
  });
}

export async function POST(req: Request) {
  let body: Body | null = null;

  try {
    body = (await req.json()) as Body;
  } catch {
    body = null;
  }

  const action = body?.action;
  if (action !== "dry_run_order") {
    return jsonError("Unknown or missing action. Use action='dry_run_order'.", { action }, 400);
  }

  const product_id = body?.product_id || "BTC-USD";
  const side = body?.side;

  if (side !== "BUY" && side !== "SELL") {
    return jsonError("Missing/invalid side. Use 'BUY' or 'SELL'.", { side }, 400);
  }

  const quote_size = body?.quote_size || "5.00";
  const base_size = body?.base_size || "0.00002";

  const client_order_id =
    body?.client_order_id && body.client_order_id.trim().length > 0
      ? body.client_order_id.trim()
      : `yc_dry_${Date.now()}`;

  const orderPayload: any = {
    client_order_id,
    product_id,
    side,
    order_configuration: {
      market_market_ioc: side === "BUY" ? { quote_size } : { base_size },
    },
  };

  return NextResponse.json({
    ok: true,
    mode: "DRY_RUN",
    trading_enabled: EXECUTION_ENABLED,
    endpoint: "POST /api/pulse-trade",
    would_call: "POST https://api.coinbase.com/api/v3/brokerage/orders",
    payload: orderPayload,
    note:
      "This did NOT place an order. It only built the payload. " +
      (EXECUTION_ENABLED
        ? "Execution gate is ON (future-proof), but there is STILL no execution code here."
        : "Execution gate is OFF."),
  });
}
