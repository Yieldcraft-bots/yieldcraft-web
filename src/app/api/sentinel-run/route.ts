// src/app/api/sentinel-run/route.ts

import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ENABLED = process.env.SENTINEL_ENABLED === "true";

    if (!ENABLED) {
      return NextResponse.json({
        ok: false,
        reason: "sentinel_disabled",
      });
    }

    const product_id = process.env.SENTINEL_PRODUCT || "BTC-USD";
    const quote_size = process.env.SENTINEL_BUY_USD || "10.00";

    // 🚨 SAFE V1: NO REAL TRADE YET
    // This is a dry-run structure to verify system behavior

    console.log("🟢 Sentinel Triggered", {
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

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    });
  }
}