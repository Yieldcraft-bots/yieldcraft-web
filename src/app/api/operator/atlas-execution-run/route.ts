/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Protected Execution Run
 *
 * PURPOSE
 * Execute only an already approved and authorized
 * Atlas Multi-Asset plan.
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
 * - Live requires ATLAS_MULTI_ASSET_LIVE_ARMED=true
 * - Live requires ATLAS_MULTI_ASSET_DRY_RUN=false
 * - Optional productId may only NARROW an authorized plan
 * - No caller-created execution instructions
 * - No legacy Atlas BTC controls
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
        "Cache-Control":
          "no-store",
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

    /*
     * ========================================================
     * OPERATOR AUTHENTICATION
     * ========================================================
     */

    const configuredToken =
      process.env
        .ATLAS_APPROVAL_OPERATOR_TOKEN;


    if (!configuredToken) {
      return json(
        500,
        {
          ok: false,

          error:
            "missing_ATLAS_APPROVAL_OPERATOR_TOKEN",
        }
      );
    }


    const suppliedToken =
      getOperatorToken(
        req
      );


    if (
      !suppliedToken ||
      suppliedToken !==
        configuredToken
    ) {
      return json(
        401,
        {
          ok: false,

          error:
            "unauthorized",
        }
      );
    }


    /*
     * ========================================================
     * REQUEST
     * ========================================================
     */

    const body: unknown =
      await req
        .json()
        .catch(
          () => null
        );


    if (
      typeof body !== "object" ||
      body === null
    ) {
      return json(
        400,
        {
          ok: false,

          error:
            "invalid_request_body",
        }
      );
    }


    const approvalIdValue =
      Reflect.get(
        body,
        "approvalId"
      );


    const authorizationIdValue =
      Reflect.get(
        body,
        "authorizationId"
      );


    const userIdValue =
      Reflect.get(
        body,
        "userId"
      );


    /*
     * Optional controlled-execution selector.
     *
     * This selector can ONLY choose an instruction already
     * present in the approved/authorized persisted plan.
     *
     * It cannot create or modify an instruction.
     */
    const productIdValue =
      Reflect.get(
        body,
        "productId"
      );


    const approvalId =
      typeof approvalIdValue ===
        "string"
        ? approvalIdValue.trim()
        : "";


    const authorizationId =
      typeof authorizationIdValue ===
        "string"
        ? authorizationIdValue.trim()
        : "";


    const userId =
      typeof userIdValue ===
        "string"
        ? userIdValue.trim()
        : "";


    const requestedProductId =
      typeof productIdValue ===
        "string"
        ? productIdValue.trim()
        : "";


    if (!approvalId) {
      return json(
        400,
        {
          ok: false,

          error:
            "missing_approval_id",
        }
      );
    }


    if (!authorizationId) {
      return json(
        400,
        {
          ok: false,

          error:
            "missing_authorization_id",
        }
      );
    }


    if (!userId) {
      return json(
        400,
        {
          ok: false,

          error:
            "missing_user_id",
        }
      );
    }


    /*
     * ========================================================
     * LOAD AUTHORIZATION
     * ========================================================
     */

    const approvalRepository =
      new SupabaseAtlasApprovalRepository();


    const authorizationRepository =
      new SupabaseAtlasExecutionAuthorizationRepository();


    const authorization =
      await authorizationRepository.load(
        authorizationId,
        userId
      );


    if (!authorization) {
      return json(
        404,
        {
          ok: false,

          error:
            "authorization_not_found",
        }
      );
    }


    /*
     * Hard binding:
     * supplied approval must be exactly the approval
     * that created this authorization.
     */
    if (
      authorization.approvalId !==
      approvalId
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "authorization_approval_mismatch",
        }
      );
    }


    /*
     * ========================================================
     * LOAD APPROVAL
     * ========================================================
     */

    const approval =
      await approvalRepository.load(
        approvalId,
        authorization.userId
      );


    if (!approval) {
      return json(
        404,
        {
          ok: false,

          error:
            "approval_not_found",
        }
      );
    }


    if (
      approval.status !==
      "APPROVED"
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "approval_not_approved",
        }
      );
    }


    /*
     * Approval and authorization must reference
     * the exact same persisted portfolio plan.
     */
    if (
      approval.portfolioPlanId !==
      authorization.portfolioPlanId
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "approval_authorization_plan_mismatch",
        }
      );
    }


    /*
     * ========================================================
     * AUTHORIZATION GATE
     * ========================================================
     */

    const gate =
      evaluateAtlasExecutionAuthorizationGate(
        authorization
      );


    if (!gate.authorized) {
      return json(
        403,
        {
          ok: false,

          error:
            gate.reason,
        }
      );
    }


    /*
     * ========================================================
     * PERSISTED PLAN
     * ========================================================
     */

    const storedPlan =
      await loadAtlasPortfolioPlan(
        authorization.portfolioPlanId
      );


    if (!storedPlan) {
      return json(
        404,
        {
          ok: false,

          error:
            "portfolio_plan_not_found",
        }
      );
    }


    const execution =
      buildAtlasExecutionInstructions(
        storedPlan.plan
      );


    if (
      !execution.executable ||
      execution.instructions.length ===
        0
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "no_executable_instructions",

          execution,
        }
      );
    }


    /*
     * ========================================================
     * OPTIONAL SINGLE-PRODUCT NARROWING
     * ========================================================
     *
     * productId can only REDUCE the instruction set.
     */

    const selectedInstructions =
      requestedProductId
        ? execution.instructions.filter(
            (
              instruction
            ) =>
              instruction.productId ===
              requestedProductId
          )
        : execution.instructions;


    if (
      selectedInstructions.length ===
      0
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "requested_product_not_authorized_for_execution",

          requestedProductId,

          authorizedProductIds:
            execution.instructions.map(
              (
                instruction
              ) =>
                instruction.productId
            ),
        }
      );
    }


    if (
      requestedProductId &&
      selectedInstructions.length !==
        1
    ) {
      return json(
        403,
        {
          ok: false,

          error:
            "requested_product_instruction_not_unique",

          requestedProductId,

          matches:
            selectedInstructions.length,
        }
      );
    }


    /*
     * ========================================================
     * MULTI-ASSET LIVE / SHADOW MODE
     * ========================================================
     *
     * IMPORTANT:
     *
     * These are deliberately independent from legacy Atlas.
     *
     * Multi-Asset live execution requires BOTH:
     *
     * ATLAS_MULTI_ASSET_LIVE_ARMED=true
     * ATLAS_MULTI_ASSET_DRY_RUN=false
     *
     * Missing/malformed values fail safely to SHADOW.
     */

    const liveArmed =
      process.env
        .ATLAS_MULTI_ASSET_LIVE_ARMED ===
      "true";


    const dryRunDisabled =
      process.env
        .ATLAS_MULTI_ASSET_DRY_RUN ===
      "false";


    const liveEnabled =
      liveArmed &&
      dryRunDisabled;


    /*
     * ========================================================
     * DISPATCH
     * ========================================================
     */

    const dispatch =
      await dispatchAtlasExecutionInstructions(
        selectedInstructions,

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


    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return json(
      200,
      {
        ok: true,

        mode:
          liveEnabled
            ? "live"
            : "shadow",

        safety: {
          scope:
            "atlas_multi_asset",

          liveArmed,

          dryRun:
            !dryRunDisabled,

          liveEnabled,

          controlledProduct:
            requestedProductId ||
            null,

          dispatchedInstructions:
            selectedInstructions.length,
        },

        approval,

        authorization,

        gate,

        portfolioPlan:
          storedPlan,

        execution,

        selectedInstructions,

        dispatch,
      }
    );

  } catch (
    error
  ) {

    return json(
      500,
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "unknown_error",
      }
    );
  }
}