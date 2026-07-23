/**
 * ============================================================
 * Atlas Shadow Execution Route
 * ------------------------------------------------------------
 * PURPOSE
 * Classify a supplied Atlas execution adapter result through
 * the read-only execution bridge.
 *
 * SAFETY
 * - Shadow mode only
 * - No trading
 * - No Coinbase
 * - No Supabase
 * - No Pulse
 * - No Atlas execution
 * - No environment variables
 * - No order submission
 *
 * This route accepts test data and returns a readiness report.
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  buildExecutionBridgeReport,
} from "@/lib/atlas-execution-bridge";
import type {
  AtlasExecutionAdapterResult,
  AtlasExecutionInstruction,
} from "@/lib/atlas-execution-adapter";
import type {
  PortfolioExecutionPlanOrder,
} from "@/lib/portfolio-execution-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isExecutionInstruction(
  value: unknown
): value is AtlasExecutionInstruction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.symbol === "string" &&
    typeof value.brokerId === "string" &&
    typeof value.productId === "string" &&
    (value.fundingCurrency === "USD" ||
      value.fundingCurrency === "USDC") &&
    typeof value.quoteSizeUsd === "number" &&
    Number.isFinite(value.quoteSizeUsd) &&
    value.quoteSizeUsd >= 0
  );
}

function isBlockedOrder(
  value: unknown
): value is PortfolioExecutionPlanOrder {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.symbol === "string" &&
    typeof value.targetPercent === "number" &&
    Number.isFinite(value.targetPercent) &&
    typeof value.proposedBuyUsd === "number" &&
    Number.isFinite(value.proposedBuyUsd) &&
    typeof value.brokerId === "string" &&
    (typeof value.productId === "string" ||
      value.productId === null) &&
    value.executable === false &&
    typeof value.reason === "string"
  );
}

function parseAdapterResult(
  value: unknown
): AtlasExecutionAdapterResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const instructions = value.instructions;
  const blocked = value.blocked;

  if (!Array.isArray(instructions) || !Array.isArray(blocked)) {
    return null;
  }

  if (!instructions.every(isExecutionInstruction)) {
    return null;
  }

  if (!blocked.every(isBlockedOrder)) {
    return null;
  }

  return {
    executable: instructions.length > 0,
    instructions,
    blocked,
  };
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);

    if (!isRecord(body)) {
      return json(400, {
        ok: false,
        error: "invalid_request_body",
      });
    }

    const adapterResult = parseAdapterResult(
      body.adapterResult
    );

    if (!adapterResult) {
      return json(400, {
        ok: false,
        error: "invalid_adapter_result",
        message:
          "adapterResult must contain valid instructions and blocked arrays.",
      });
    }

    const report =
      buildExecutionBridgeReport(adapterResult);

    return json(200, {
      ok: true,
      mode: "SHADOW",
      executionSubmitted: false,
      report,
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return json(500, {
      ok: false,
      error: "server_error",
      details,
    });
  }
}