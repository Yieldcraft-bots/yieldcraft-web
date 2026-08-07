/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Decision Route
 * ------------------------------------------------------------
 * PURPOSE
 * Process operator decisions for an existing execution
 * authorization contract.
 *
 * SAFETY
 * - Operator controlled
 * - State transition only
 * - No Coinbase
 * - No orders
 * - No execution
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * This route does not execute anything.
 * It only transitions authorization state.
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  transitionAtlasExecutionAuthorization,
  evaluateAtlasExecutionAuthorizationGate,
} from "@/lib/atlas-operations";

import {
  SupabaseAtlasExecutionAuthorizationRepository,
} from "@/lib/repositories/atlasExecutionAuthorizationRepository";

import type {
  AtlasExecutionAuthorizationStatus,
} from "@/lib/atlas-operations";

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

function isAuthorizationStatus(
  value: unknown
): value is AtlasExecutionAuthorizationStatus {
  return (
    value === "AUTHORIZED" ||
    value === "REVOKED"
  );
}

const authorizationRepository =
  new SupabaseAtlasExecutionAuthorizationRepository();

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

    const authorizationId =
      Reflect.get(body, "authorizationId");

    const nextStatus =
      Reflect.get(body, "nextStatus");

    if (
      typeof authorizationId !== "string" ||
      !authorizationId.trim()
    ) {
      return json(400, {
        ok: false,
        error: "missing_authorization_id",
      });
    }

    if (!isAuthorizationStatus(nextStatus)) {
      return json(400, {
        ok: false,
        error: "invalid_authorization_status",
      });
    }

    const authorization =
      await authorizationRepository.load(
        authorizationId.trim()
      );

    if (!authorization) {
      return json(404, {
        ok: false,
        error: "authorization_not_found",
      });
    }

    const transitioned =
      transitionAtlasExecutionAuthorization(
        authorization,
        nextStatus
      );

    await authorizationRepository.save(
      transitioned
    );

    const gate =
      evaluateAtlasExecutionAuthorizationGate(
        transitioned
      );

    return json(200, {
      ok: true,
      authorization: transitioned,
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