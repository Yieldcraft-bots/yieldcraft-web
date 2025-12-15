import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * pulse-trade (SAFE)
 * - DRY RUN ONLY: builds an order payload but does NOT call Coinbase.
 * - No JWT duplication. No auth changes. No execution.
 */

type Side = "BUY" | "SELL";

function jsonError(message: string, extra: Record<string, any> = {}, status = 400) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body
  }

  const action = (body?.action ?? "status") as string;

  // Simple status probe (what you already verified)
  if (action === "status") {
    return NextResponse.json({
      ok: true,
      status: "PULSE_TRADE_READY",
      trading_enabled: false,
      note: "DRY-RUN builder only. No execution.",
    });
  }

  // DRY RUN: build Coinbase Advanced Trade payload (no network call)
  if (action === "dry_run_order") {
    const product_id = String(body?.product_id ?? "BTC-USD");
    const side = String(body?.side ?? "BUY").toUpperCase() as Side;

    if (!product_id.includes("-")) return jsonError("Invalid product_id (expected like BTC-USD).", { product_id });
    if (side !== "BUY" && side !== "SELL") return jsonError("Invalid side (BUY or SELL).", { side });

    // Choose one: quote_size OR base_size
    const quote_size = body?.quote_size != null ? String(body.quote_size) : null;
    const base_size = body?.base_size != null ? String(body.base_size) : null;

    if ((quote_size && base_size) || (!quote_size && !base_size)) {
      return jsonError("Provide exactly one of quote_size or base_size.", { quote_size, base_size });
    }

    // Coinbase Advanced Trade MARKET IOC format:
    // POST /api/v3/brokerage/orders
    // { client_order_id, product_id, side, order_configuration: { market_market_ioc: { quote_size | base_size } } }
    const client_order_id =
      typeof body?.client_order_id === "string" && body.client_order_id.length >= 8
        ? body.client_order_id
        : `yc_dry_${Date.now()}`;

    const orderPayload: any = {
      client_order_id,
      product_id,
      side,
      order_configuration: {
        market_market_ioc: quote_size ? { quote_size } : { base_size },
      },
    };

    return NextResponse.json({
      ok: true,
      mode: "DRY_RUN",
      trading_enabled: false,
      endpoint: "POST /api/pulse-trade",
      would_call: "POST https://api.coinbase.com/api/v3/brokerage/orders",
      payload: orderPayload,
      note: "This did NOT place an order. It only built the payload.",
    });
  }

  return jsonError("Unknown action.", { action }, 400);
}
