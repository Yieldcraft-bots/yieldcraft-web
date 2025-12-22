// src/app/api/pulse-manager/route.ts
// Pulse Manager: lightweight orchestrator (safe + build-stable)
//
// Goals:
// - Never break production trading routes
// - Provide a single "tick" endpoint you can cron
// - Delegate actual execution to /api/pulse-trade (which already has gates)
//
// Endpoints:
//   GET  -> status
//   POST -> { action: "status" | "tick" | "dry_run" | "place_order", ... }
//
// Security (recommended):
//   If CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET>

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

type Side = "BUY" | "SELL";

function truthy(v?: string) {
  return ["1", "true", "yes", "on"].includes((v || "").toLowerCase());
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Optional auth:
 * If CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET>
 */
function cronAuthorized(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

/** Manager gates (separate from execution gates in pulse-trade) */
function managerGates() {
  const managerEnabled = truthy(process.env.PULSE_MANAGER_ENABLED || "true"); // default on
  const soakMode = truthy(process.env.PULSE_SOAK_MODE || "true"); // default soak ON
  return { managerEnabled, soakMode };
}

/**
 * Compute a "min position" threshold (BTC) so small accounts don't churn.
 * - For tiny accounts, set a small base threshold to prevent spam.
 * - For big accounts, threshold stays tiny relative to size.
 */
function minPositionBaseBtc() {
  const raw = (process.env.PULSE_MIN_POSITION_BASE_BTC || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 0.000001; // default: 0.000001 BTC
}

/**
 * Read a position snapshot from the execution route if available.
 * NOTE: This does NOT place orders — it just asks /api/pulse-trade for status
 * and expects it may include a position object.
 *
 * If pulse-trade doesn’t include position info, this returns base=0 safely.
 */
async function getExecutionStatus(origin: string) {
  const url = `${origin.replace(/\/$/, "")}/api/pulse-trade`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);

  // Safe defaults to prevent TS + runtime issues
  const gates = parsed?.gates ?? null;

  // If your pulse-trade returns position, we’ll use it. Otherwise: base=0
  const pos = parsed?.position ?? parsed?.pos ?? null;

  const base =
    typeof pos?.base === "number"
      ? pos.base
      : typeof pos?.base === "string"
      ? Number(pos.base)
      : typeof pos?.base_size === "string"
      ? Number(pos.base_size)
      : 0;

  return {
    ok: res.ok,
    status: res.status,
    gates,
    position: {
      base: Number.isFinite(base) ? base : 0,
      raw: pos ?? null,
    },
    raw: parsed ?? text,
  };
}

/**
 * Call the execution route (/api/pulse-trade) to do a dry-run or live order.
 * pulse-trade has its own gates: COINBASE_TRADING_ENABLED + PULSE_TRADE_ARMED.
 */
async function callPulseTrade(origin: string, payload: any) {
  const url = `${origin.replace(/\/$/, "")}/api/pulse-trade`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Forward CRON auth if you’re using it everywhere
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const parsed = safeJsonParse(text);
  return {
    ok: res.ok,
    status: res.status,
    body: parsed ?? text,
  };
}

/**
 * The manager "tick":
 * - Reads current status/position (best effort)
 * - If SOAK is on: defaults to DRY_RUN unless explicitly told to place live
 * - If a BUY is requested but position already exists, it returns no-op
 */
async function tick(origin: string, body: any) {
  const { managerEnabled, soakMode } = managerGates();
  if (!managerEnabled) {
    return {
      ok: true,
      did: "manager_disabled",
      managerEnabled,
      soakMode,
    };
  }

  const product_id = String(body?.product_id || "BTC-USD");
  const requestedSide = String(body?.side || "BUY").toUpperCase() as Side;
  const quote_size = body?.quote_size != null ? String(body.quote_size) : "1.00";
  const base_size = body?.base_size != null ? String(body.base_size) : "0.00001";

  // Read current status (safe)
  const exec = await getExecutionStatus(origin);

  // ✅ Build-stable: always coerce to a number; never undefined
  const positionBase = Number(exec?.position?.base ?? 0);
  const minPos = minPositionBaseBtc();

  // If we already hold something meaningful, block repeated BUY spam
  if (requestedSide === "BUY" && positionBase >= minPos) {
    return {
      ok: true,
      did: "no_op",
      reason: "buy_blocked_position_exists",
      positionBase,
      minPos,
      exec: { ok: exec.ok, status: exec.status, gates: exec.gates },
    };
  }

  // Decide action
  const forceLive = truthy(body?.force_live);
  const action =
    body?.action === "place_order" || body?.action === "live"
      ? "place_order"
      : body?.action === "dry_run_order" || body?.action === "dry_run"
      ? "dry_run_order"
      : soakMode && !forceLive
      ? "dry_run_order"
      : "place_order";

  const payload =
    requestedSide === "BUY"
      ? { action, product_id, side: "BUY", quote_size }
      : { action, product_id, side: "SELL", base_size };

  const result = await callPulseTrade(origin, payload);

  return {
    ok: true,
    did: "tick",
    managerEnabled,
    soakMode,
    decided_action: action,
    requested: { product_id, side: requestedSide, quote_size, base_size },
    positionBase,
    minPos,
    pulse_trade: { ok: result.ok, status: result.status, body: result.body },
  };
}

// -------------------- GET --------------------

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return json(401, { ok: false, error: "unauthorized" });

  const { managerEnabled, soakMode } = managerGates();
  return json(200, {
    ok: true,
    status: "PULSE_MANAGER_READY",
    gates: { managerEnabled, soakMode },
    note: "POST {action:'tick'} to run orchestration. Execution is delegated to /api/pulse-trade.",
  });
}

// -------------------- POST --------------------

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return json(401, { ok: false, error: "unauthorized" });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body?.action || "status");

  // Figure origin for internal calls
  const origin = new URL(req.url).origin;

  if (action === "status") {
    const { managerEnabled, soakMode } = managerGates();
    const exec = await getExecutionStatus(origin);

    return json(200, {
      ok: true,
      status: "PULSE_MANAGER_READY",
      gates: { managerEnabled, soakMode },
      exec: {
        ok: exec.ok,
        status: exec.status,
        gates: exec.gates,
        positionBase: Number(exec?.position?.base ?? 0),
      },
    });
  }

  if (action === "tick" || action === "dry_run" || action === "live" || action === "place_order") {
    const result = await tick(origin, body);
    return json(200, result);
  }

  return json(400, { ok: false, error: "unknown_action", action });
}
