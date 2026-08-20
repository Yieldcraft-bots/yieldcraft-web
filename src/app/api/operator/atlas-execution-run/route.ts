/**
 * ============================================================
 * YieldCraft Atlas
 * Protected Execution Run
 *
 * PURPOSE
 * Execute only an already approved and authorized Atlas plan.
 *
 * SAFETY
 * - Operator controlled
 * - Approval required
 * - Authorization required
 * - Approval must belong to authorization
 * - Approval and authorization must reference same plan
 * - Gate required
 * - Executable instructions required
 * - Shadow execution default
 * - Live execution requires ATLAS_LIVE_ARMED
 * - No UI authority
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

import {
  executeAtlasLiveInstruction,
} from "@/lib/atlas-live-execution-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(
  status: number,
  body: unknown
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function getOperatorToken(
  req: Request
): string {
  return (
    req.headers.get(
      "x-atlas-operator-token"
    ) ?? ""
  ).trim();
}

export async function POST(
  req: Request
) {
  try {
    const configuredToken =
      process.env
        .ATLAS_APPROVAL_OPERATOR_TOKEN;

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
      await req
        .json()
        .catch(() => null);

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return json(400, {
        ok: false,
        error:
          "invalid_request_body",
      });
    }

    const approvalId =
      Reflect.get(
        body,
        "approvalId"
      );

    const authorizationId =
      Reflect.get(
        body,
        "authorizationId"
      );

    const userId =
      Reflect.get(
        body,
        "userId"
      );

    if (
      typeof approvalId !== "string" ||
      !approvalId.trim()
    ) {
      return json(400, {
        ok: false,
        error:
          "missing_approval_id",
      });
    }

    if (
      typeof authorizationId !==
        "string" ||
      !authorizationId.trim()
    ) {
      return json(400, {
        ok: false,
        error:
          "missing_authorization_id",
      });
    }

    if (
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      return json(400, {
        ok: false,
        error:
          "missing_user_id",
      });
    }

    const approvalRepository =
      new SupabaseAtlasApprovalRepository();

    const authorizationRepository =
      new SupabaseAtlasExecutionAuthorizationRepository();

    const authorization =
      await authorizationRepository.load(
        authorizationId.trim(),
        userId.trim()
      );

    if (!authorization) {
      return json(404, {
        ok: false,
        error:
          "authorization_not_found",
      });
    }

    /*
     * Hard binding:
     * the supplied approval must be the
     * approval that created this authorization.
     */
    if (
      authorization.approvalId !==
      approvalId.trim()
    ) {
      return json(403, {
        ok: false,
        error:
          "authorization_approval_mismatch",
      });
    }

    const approval =
      await approvalRepository.load(
        approvalId.trim(),
        authorization.userId
      );

    if (!approval) {
      return json(404, {
        ok: false,
        error:
          "approval_not_found",
      });
    }

    if (
      approval.status !==
      "APPROVED"
    ) {
      return json(403, {
        ok: false,
        error:
          "approval_not_approved",
      });
    }

    /*
     * Hard binding:
     * approval and authorization must
     * reference the exact same plan.
     */
    if (
      approval.portfolioPlanId !==
      authorization.portfolioPlanId
    ) {
      return json(403, {
        ok: false,
        error:
          "approval_authorization_plan_mismatch",
      });
    }

    const gate =
      evaluateAtlasExecutionAuthorizationGate(
        authorization
      );

    if (!gate.authorized) {
      return json(403, {
        ok: false,
        error:
          gate.reason,
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

    if (
      !execution.executable ||
      execution.instructions.length === 0
    ) {
      return json(403, {
        ok: false,
        error:
          "no_executable_instructions",
        execution,
      });
    }

    const liveEnabled =
      process.env
        .ATLAS_LIVE_ARMED ===
      "true";

    const dispatch =
      await dispatchAtlasExecutionInstructions(
        execution.instructions,
        async (
          instruction
        ) => {
          if (liveEnabled) {
            return {
              instruction,

              ...(
                await executeAtlasLiveInstruction(
                  instruction,
                  authorization
                )
              ),
            };
          }

          return {
            instruction,

            ...(
              await routeAtlasExecution(
                instruction
              )
            ),
          };
        }
      );

    return json(200, {
      ok: true,

      mode:
        liveEnabled
          ? "live"
          : "shadow",

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