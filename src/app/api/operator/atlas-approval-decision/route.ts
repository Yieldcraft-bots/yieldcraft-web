/**
 * ============================================================
 * Atlas Operations
 * Approval Decision Route
 *
 * ------------------------------------------------------------
 * PURPOSE
 * Process an operator decision for an EXISTING Atlas approval.
 *
 * SECURITY
 * - Caller supplies approvalId + nextStatus
 * - Existing approval is loaded from trusted persistence
 * - Operator token is required in request header
 *
 * SAFETY
 * - No Coinbase
 * - No orders
 * - No execution
 * - Database persistence only through repository boundary
 * - No Pulse
 * - No Recon
 * - No trading
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  transitionAtlasApproval,
  evaluateAtlasApprovalGate,
} from "@/lib/atlas-operations";

import {
  SupabaseAtlasApprovalRepository,
} from "@/lib/repositories/atlasApprovalRepository";

import type {
  AtlasApprovalStatus,
} from "@/lib/atlas-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approvalRepository =
  new SupabaseAtlasApprovalRepository();


function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}


function getOperatorToken(req: Request): string {
  return (
    req.headers.get("x-atlas-operator-token") ?? ""
  ).trim();
}


function isDecisionStatus(
  value: unknown
): value is AtlasApprovalStatus {
  return (
    value === "APPROVED" ||
    value === "REJECTED"
  );
}


export async function POST(req: Request) {
  try {
    const configuredToken =
      process.env.ATLAS_APPROVAL_OPERATOR_TOKEN;


    if (!configuredToken) {
      return json(500, {
        ok: false,
        error:
          "missing_ATLAS_APPROVAL_OPERATOR_TOKEN",
      });
    }


    const suppliedToken =
      getOperatorToken(req);


    if (
      !suppliedToken ||
      suppliedToken !== configuredToken
    ) {
      return json(401, {
        ok: false,
        error: "unauthorized",
      });
    }


    const body: unknown =
      await req.json().catch(() => null);


    if (
      typeof body !== "object" ||
      body === null
    ) {
      return json(400, {
        ok: false,
        error: "invalid_request_body",
      });
    }


    const approvalId =
      Reflect.get(body, "approvalId");


    const nextStatus =
      Reflect.get(body, "nextStatus");


    if (
      typeof approvalId !== "string" ||
      !approvalId.trim()
    ) {
      return json(400, {
        ok: false,
        error: "missing_approval_id",
      });
    }


    if (!isDecisionStatus(nextStatus)) {
      return json(400, {
        ok: false,
        error: "invalid_approval_status",
      });
    }


    const storedApproval =
      await approvalRepository.load(
        approvalId.trim(),
        Reflect.get(
          body,
          "userId"
        )
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
    console.error(
      "ATLAS_APPROVAL_DECISION_ERROR",
      error
    );


    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "unknown_error",
    });
  }
}