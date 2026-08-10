/**
 * ============================================================
 * YieldCraft Atlas
 * Protected Execution Run
 *
 * ---
 * PURPOSE
 * Execute only an already approved and authorized Atlas plan.
 *
 * SAFETY
 *
 * - Operator controlled
 * - Approval required
 * - Authorization required
 * - Gate required
 * - Shadow execution only
 * - No live orders
 * - No Coinbase submission
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  SupabaseAtlasApprovalRepository,
} from "@/lib/repositories/atlasApprovalRepository";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "@/lib/repositories/atlasExecutionAuthorizationRepository";

import {
  loadAtlasPortfolioPlan,
} from "@/lib/repositories/atlasPortfolioPlanRepository";

import {
  evaluateAtlasExecutionAuthorizationGate,
} from "@/lib/atlas-operations";

import {
  buildAtlasExecutionInstructions,
} from "@/lib/atlas-execution-adapter";

import {
  dispatchAtlasExecutionInstructions,
} from "@/lib/atlas-multi-asset-dispatcher";

import {
  routeAtlasExecution,
} from "@/lib/atlas-execution-router";

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

    const authorizationId =
      Reflect.get(body, "authorizationId");

    if (
      typeof approvalId !== "string" ||
      !approvalId.trim()
    ) {
      return json(400, {
        ok: false,
        error: "missing_approval_id",
      });
    }

    if (
      typeof authorizationId !== "string" ||
      !authorizationId.trim()
    ) {
      return json(400, {
        ok: false,
        error: "missing_authorization_id",
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

    if (approval.status !== "APPROVED") {
      return json(403, {
        ok: false,
        error:
          "approval_not_approved",
      });
    }

    const authorization =
      await authorizationRepository.load(
        authorizationId.trim()
      );

    if (!authorization) {
      return json(404, {
        ok: false,
        error:
          "authorization_not_found",
      });
    }

    const gate =
      evaluateAtlasExecutionAuthorizationGate(
        authorization
      );

    if (!gate.authorized) {
      return json(403, {
        ok: false,
        error: gate.reason,
      });
    }

    const storedPlan =
      await loadAtlasPortfolioPlan(
        authorization.portfolioPlanId
      );

    if (!storedPlan) {
      return json(404, {
        ok: false,
        error:
          "portfolio_plan_not_found",
      });
    }

    const execution =
      buildAtlasExecutionInstructions(
        storedPlan.plan
      );

    const dispatch =
      await dispatchAtlasExecutionInstructions(
        execution.instructions,
        async (instruction) => ({
          instruction,
          ...(await routeAtlasExecution(
            instruction
          )),
        })
      );

    return json(200, {
      ok: true,
      mode: "shadow",
      approval,
      authorization,
      gate,
      portfolioPlan:
        storedPlan,
      execution,
      dispatch,
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