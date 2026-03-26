import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ENABLED = process.env.SENTINEL_ENABLED === "true";
    const DRY_RUN = process.env.SENTINEL_DRY_RUN !== "false";

    if (!ENABLED) {
      return NextResponse.json({
        ok: false,
        reason: "sentinel_disabled",
      });
    }

    const product_id = process.env.SENTINEL_PRODUCT || "BTC-USD";
    const quote_size = process.env.SENTINEL_BUY_USD || "10.00";

    // SAFE MODE: verify endpoint + env wiring without placing a trade
    if (DRY_RUN) {
      console.log("🟢 Sentinel Dry Run Triggered", {
        product_id,
        quote_size,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        mode: "SENTINEL_BUY",
        product_id,
        quote_size,
        dry_run: true,
      });
    }

    // REAL BUY MODE
    // NOTE:
    // This assumes you already have a valid Coinbase bearer token/JWT
    // available as COINBASE_JWT in your environment.
    const jwt = process.env.COINBASE_JWT;

    if (!jwt) {
      return NextResponse.json({
        ok: false,
        reason: "missing_coinbase_jwt",
      });
    }

    const coinbaseRes = await fetch(
      "https://api.coinbase.com/api/v3/brokerage/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id,
          side: "BUY",
          client_order_id: `sentinel-${Date.now()}`,
          order_configuration: {
            market_market_ioc: {
              quote_size,
            },
          },
        }),
      }
    );

    const data = await coinbaseRes.json();

    return NextResponse.json({
      ok: coinbaseRes.ok,
      mode: "SENTINEL_BUY",
      product_id,
      quote_size,
      dry_run: false,
      response: data,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}