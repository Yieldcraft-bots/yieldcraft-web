// src/app/api/brain/route.ts
// YieldCraft "Brain" — coordination/intelligence layer (v0).
// Right now, this just reads env config for all bots and
// returns a clean JSON snapshot that other endpoints can use.
// No trading happens here; it's read-only and safe.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BotName = "pulse" | "horizon" | "ascend" | "ignition";

type BotConfig = {
  name: BotName;
  enabled: boolean;
  product_id: string;
  base_size: number;
  cooldown_ms: number;
  edge_min_bps: number | null;
  profit_target_bps: number | null;
  trail_arm_bps: number | null;
  trail_offset_bps: number | null;
  recon_min_conf: number | null;
  recon_signal_url: string | null;

  // Extra risk parameters for higher-tier bots
  max_trades_per_day?: number | null;
  max_daily_loss_pct?: number | null;
  max_trade_loss_pct?: number | null;
};

function boolFromEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return defaultValue;
}

function numFromEnv(value: string | undefined, defaultValue: number | null): number | null {
  if (typeof value !== "string") return defaultValue;
  const n = Number(value);
  if (Number.isNaN(n)) return defaultValue;
  return n;
}

function strFromEnv(value: string | undefined, defaultValue: string | null): string | null {
  if (typeof value !== "string") return defaultValue;
  const v = value.trim();
  return v.length > 0 ? v : defaultValue;
}

function buildPulseConfig(): BotConfig {
  return {
    name: "pulse",
    enabled: boolFromEnv(process.env.BOT_ENABLED, true) &&
             boolFromEnv(process.env.COINBASE_TRADING_ENABLED, true),
    product_id: strFromEnv(process.env.PULSE_PRODUCT, "BTC-USD")!,
    base_size: numFromEnv(process.env.PULSE_BASE_SIZE, 0.00002) ?? 0.00002,
    cooldown_ms: numFromEnv(process.env.COOLDOWN_MS, 60000) ?? 60000,
    edge_min_bps: numFromEnv(process.env.EDGE_MIN_BPS, 100),
    profit_target_bps: numFromEnv(process.env.PROFIT_TARGET_BPS, 120),
    trail_arm_bps: numFromEnv(process.env.TRAIL_ARM_BPS, 150),
    trail_offset_bps: numFromEnv(process.env.TRAIL_OFFSET_BPS, 50),
    recon_min_conf: numFromEnv(process.env.RECON_MIN_CONF, 0.60),
    recon_signal_url: strFromEnv(process.env.RECON_SIGNAL_URL, null),
  };
}

function buildHorizonConfig(): BotConfig {
  return {
    name: "horizon",
    enabled: boolFromEnv(process.env.HORIZON_ENABLED, true),
    product_id: strFromEnv(process.env.HORIZON_PRODUCT, "BTC-USD")!,
    base_size: numFromEnv(process.env.HORIZON_BASE_SIZE, 0.00002) ?? 0.00002,
    cooldown_ms: numFromEnv(process.env.HORIZON_COOLDOWN_MS, 300000) ?? 300000,
    edge_min_bps: numFromEnv(process.env.HORIZON_EDGE_MIN_BPS, 150),
    profit_target_bps: numFromEnv(process.env.HORIZON_PROFIT_TARGET_BPS, 250),
    trail_arm_bps: numFromEnv(process.env.HORIZON_TRAIL_ARM_BPS, 300),
    trail_offset_bps: numFromEnv(process.env.HORIZON_TRAIL_OFFSET_BPS, 75),
    recon_min_conf: numFromEnv(process.env.RECON_MIN_CONF, 0.60), // shared Recon for now
    recon_signal_url: strFromEnv(process.env.RECON_SIGNAL_URL, null),
  };
}

function buildAscendConfig(): BotConfig {
  return {
    name: "ascend",
    enabled: boolFromEnv(process.env.ASCEND_ENABLED, true),
    product_id: strFromEnv(process.env.ASCEND_PRODUCT, "BTC-USD")!,
    base_size: numFromEnv(process.env.ASCEND_BASE_SIZE, 0.00001) ?? 0.00001,
    cooldown_ms: numFromEnv(process.env.ASCEND_COOLDOWN_MS, 1200000) ?? 1200000,
    edge_min_bps: numFromEnv(process.env.ASCEND_EDGE_MIN_BPS, 120),
    profit_target_bps: numFromEnv(process.env.ASCEND_PROFIT_TARGET_BPS, 250),
    trail_arm_bps: numFromEnv(process.env.ASCEND_TRAIL_ARM_BPS, 200),
    trail_offset_bps: numFromEnv(process.env.ASCEND_TRAIL_OFFSET_BPS, 75),
    recon_min_conf: numFromEnv(process.env.ASCEND_RECON_MIN_CONF, 0.68),
    recon_signal_url: strFromEnv(process.env.ASCEND_RECON_SIGNAL_URL, null),
    max_trades_per_day: numFromEnv(process.env.ASCEND_MAX_TRADES_PER_DAY, 3),
    max_daily_loss_pct: numFromEnv(process.env.ASCEND_MAX_DAILY_LOSS_PCT, 2.0),
    max_trade_loss_pct: numFromEnv(process.env.ASCEND_MAX_TRADE_LOSS_PCT, 0.4),
  };
}

function buildIgnitionConfig(): BotConfig {
  return {
    name: "ignition",
    enabled: boolFromEnv(process.env.IGNITION_ENABLED, true),
    product_id: strFromEnv(process.env.IGNITION_PRODUCT, "BTC-USD")!,
    base_size: numFromEnv(process.env.IGNITION_BASE_SIZE, 0.000005) ?? 0.000005,
    cooldown_ms: numFromEnv(process.env.IGNITION_COOLDOWN_MS, 60000) ?? 60000,
    edge_min_bps: numFromEnv(process.env.IGNITION_EDGE_MIN_BPS, 80),
    profit_target_bps: numFromEnv(process.env.IGNITION_PROFIT_TARGET_BPS, 90),
    trail_arm_bps: numFromEnv(process.env.IGNITION_TRAIL_ARM_BPS, 110),
    trail_offset_bps: numFromEnv(process.env.IGNITION_TRAIL_OFFSET_BPS, 40),
    recon_min_conf: numFromEnv(process.env.IGNITION_RECON_MIN_CONF, 0.62),
    recon_signal_url: strFromEnv(process.env.IGNITION_RECON_SIGNAL_URL, null),
  };
}

export async function GET() {
  try {
    const bots: BotConfig[] = [
      buildPulseConfig(),
      buildHorizonConfig(),
      buildAscendConfig(),
      buildIgnitionConfig(),
    ];

    const enabledBots = bots.filter((b) => b.enabled);

    // For small accounts, default recommendation: max 2 bots live at once.
    const maxSimultaneousBots =
      numFromEnv(process.env.BRAIN_MAX_SIMULTANEOUS_BOTS, 2) ?? 2;

    const body = {
      ok: true,
      ts: new Date().toISOString(),
      risk_tier: "small_account", // future: make dynamic based on balance
      max_simultaneous_bots: maxSimultaneousBots,
      enabled_bots_count: enabledBots.length,
      bots,
    };

    return NextResponse.json(body, { status: 200 });
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
