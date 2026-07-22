/**
 * ============================================================
 * Atlas Operations
 * Admin Status API
 * ------------------------------------------------------------
 * PURPOSE
 * Return the current read-only Atlas Operations snapshot.
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

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { buildAtlasOperationsSnapshot } from "@/lib/atlas-operations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorized =
      await isAuthorizedAdminRequest(request);

    if (!authorized) {
      return NextResponse.json(
        {
          error: "Admin authorization is required.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const snapshot =
      buildAtlasOperationsSnapshot();

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[atlas-operations-status] Failed to build operations response:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to build Atlas Operations response.",
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