import { NextResponse } from "next/server";

import { buildEdgeIntelligenceSnapshot } from "@/lib/edge-intelligence/buildEdgeIntelligenceSnapshot";

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

export async function GET() {
  try {
    const snapshot = await buildEdgeIntelligenceSnapshot();

    return json(200, snapshot);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    return json(500, {
      ok: false,
      status: "EDGE_INTELLIGENCE_READ_ERROR",
      error: message,
      readOnly: true,
      executionChangesAllowed: false,
      shortExecutionEnabled: false,
    });
  }
}