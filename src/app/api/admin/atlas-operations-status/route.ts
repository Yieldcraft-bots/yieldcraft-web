/**
 * ============================================================
 * Atlas Operations
 * Admin Status API
 * ------------------------------------------------------------
 * PURPOSE
 * Return the current read-only Atlas Operations snapshot and
 * derived operational metrics.
 *
 * Single Responsibility:
 * Expose Atlas Operations data through an HTTP GET endpoint.
 *
 * This route performs NO business logic.
 * This route performs NO execution.
 * This route performs NO persistence.
 * This route performs NO trading.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No Database writes
 * - No Orders
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  buildAtlasOperationsSnapshot,
  getAtlasOperationsMetrics,
} from "@/lib/atlas-operations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = buildAtlasOperationsSnapshot();
    const metrics = getAtlasOperationsMetrics();

    return NextResponse.json(
      {
        ...snapshot,
        metrics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "[atlas-operations-status] Failed to build operations response:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to build Atlas Operations response.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}