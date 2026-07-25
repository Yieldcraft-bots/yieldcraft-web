/**
 * ============================================================
 * Atlas Operations
 * Approval Decision Route
 * ------------------------------------------------------------
 * PURPOSE
 * Process an approval status decision.
 *
 * This route ONLY transitions approval state.
 *
 * SAFETY
 * - No Coinbase
 * - No orders
 * - No execution
 * - No database
 * - No Pulse
 * - No Recon
 * - No trading
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  transitionAtlasApproval,
  evaluateAtlasApprovalGate,
  InMemoryAtlasApprovalRepository,
} from "@/lib/atlas-operations";

import type {
  AtlasApprovalContract,
  AtlasApprovalStatus,
} from "@/lib/atlas-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approvalRepository =
  new InMemoryAtlasApprovalRepository();

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const approval =
      body.approval as AtlasApprovalContract;

    const nextStatus =
      body.nextStatus as AtlasApprovalStatus;

    if (!approval || !nextStatus) {
      return json(400, {
        ok: false,
        error: "missing_approval_or_status",
      });
    }

    await approvalRepository.save(
      approval
    );

    const storedApproval =
      await approvalRepository.load(
        approval.approvalId
      );

    if (!storedApproval) {
      return json(404, {
        ok: false,
        error: "approval_not_found",
      });
    }

    const transitioned =
      transitionAtlasApproval(
        storedApproval,
        nextStatus
      );

    await approvalRepository.save(
      transitioned
    );

    const gate =
      evaluateAtlasApprovalGate(
        transitioned
      );

    return json(200, {
      ok: true,
      approval: transitioned,
      gate,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });
  }
}