/**
 * ============================================================
 * Atlas Operations
 * Admin Status API
 * ------------------------------------------------------------
 * PURPOSE
 * Return the current read-only Atlas Operations snapshot.
 *
 * Single Responsibility:
 * Expose Atlas Operations status through an HTTP GET endpoint.
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

import { buildAtlasOperationsSnapshot } from "@/lib/atlas-operations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = buildAtlasOperationsSnapshot();

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[atlas-operations-status] Failed to build operations snapshot:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to build Atlas Operations snapshot.",
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