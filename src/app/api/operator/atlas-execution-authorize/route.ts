/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Route
 * ------------------------------------------------------------
 * PURPOSE
 * Create execution authorization state from an existing
 * approved Atlas approval.
 *
 * SAFETY
 * - Operator controlled
 * - Authorization state only
 * - No Coinbase
 * - No orders
 * - No execution
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * This route does not execute anything.
 * It only creates the authorization boundary.
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  createExecutionAuthorizationFromApproval,
} from "@/lib/atlas-operations";

import {
  SupabaseAtlasApprovalRepository,
} from "@/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "@/lib/repositories/atlasExecutionAuthorizationRepository";

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

function getOperatorToken(req: Request): string {
  return (
    req.headers.get("x-atlas-operator-token") ?? ""
  ).trim();
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

    if (
      typeof approvalId !== "string" ||
      !approvalId.trim()
    ) {
      return json(400, {
        ok: false,
        error: "missing_approval_id",
      });
    }

    const approvalRepository =
      new SupabaseAtlasApprovalRepository();

    const authorizationRepository =
      new SupabaseAtlasExecutionAuthorizationRepository();

    const approval =
      await approvalRepository.load(
        approvalId.trim()
      );

    if (!approval) {
      return json(404, {
        ok: false,
        error: "approval_not_found",
      });
    }

    const result =
      await createExecutionAuthorizationFromApproval(
        approval,
        authorizationRepository
      );

    return json(200, {
      ok: true,
      authorization: result,
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