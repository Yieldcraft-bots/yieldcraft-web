// src/app/api/pulse-trade/route.ts
// Pulse Trade (SAFE): DRY_RUN order builder + hard execution gate.
// - GET returns status so curl/browser doesn't 405
// - POST builds Coinbase Advanced Trade order payload shape for MARKET_IOC
// - NO execution code in this file (by design)

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, extra: Record<string, any> = {}, status = 400) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function envBool(name: string, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase().trim());
}

export async function GET() {
  const EXECUTION_ENABLED = envBool("PULSE_TRADE_EXECUTION_ENABLED", false);

  return NextResponse.json({
    ok: true,
    status: "PULSE_TRADE_READY",
    trading_enabled: EXECUTION_ENABLED,
    note: "GET is alive. Use POST with {action:'dry_run_order'} to build an order payload. No execution here.",
  });
}

export async function POST(req: Request) {
  const EXECUTION_ENABLED = envBool("PULSE_TRADE_EXECUTION_ENABLED", false);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const action = body?.action;

  if (action === "dry_run_order") {
    const product_id = String(body?.product_id || "BTC-USD");
    const side = String(body?.side || "BUY").toUpperCase();

    if (side !== "BUY" && side !== "SELL") {
      return jsonError("side must be BUY or SELL", { side });
    }

    const quote_size = body?.quote_size != null ? String(body.quote_size) : undefined;
    const base_size = body?.base_size != null ? String(body.base_size) : undefined;

    // Validate required sizing
    if (side === "BUY" && !quote_size) {
      return jsonError("BUY requires quote_size", { example: { quote_size: "5.00" } });
    }
    if (side === "SELL" && !base_size) {
      return jsonError("SELL requires base_size", { example: { base_size: "0.00002" } });
    }

    const client_order_id =
      body?.client_order_id != null ? String(body.client_order_id) : `yc_dry_${Date.now()}`;

    // Coinbase Advanced Trade payload shape for MARKET IOC:
    // order_configuration.market_market_ioc.{quote_size|base_size}
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

  return jsonError("Unknown action.", { action }, 400);
}
