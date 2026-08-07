/**
 * ============================================================
 * YieldCraft Atlas
 * Multi Asset Governance Run
 * ------------------------------------------------------------
 * PURPOSE
 * Build a client-selected Atlas portfolio plan and create the
 * required approval boundary.
 *
 * SAFETY
 * - Operator controlled
 * - Client allocation driven
 * - No automatic approval
 * - No execution dispatch
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * This route creates governance state only.
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  buildClientPortfolioPlan,
} from "@/lib/atlas-intelligence/portfolio-plan-service";

import {
  createAtlasApproval,
} from "@/lib/atlas-operations";

import {
  SupabaseAtlasApprovalRepository,
} from "@/lib/repositories/atlasApprovalRepository";

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

function okAuth(req: Request) {
  const secret =
    process.env.ATLAS_RUN_SECRET ??
    process.env.CRON_SECRET ??
    "";

  if (!secret.trim()) {
    return false;
  }

  const header =
    req.headers.get("x-atlas-run-secret") ??
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization");

  if (
    header === secret ||
    header === `Bearer ${secret}`
  ) {
    return true;
  }

  const url = new URL(req.url);

  return url.searchParams.get("secret") === secret;
}

export async function POST(req: Request) {
  if (!okAuth(req)) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  const body = await req.json().catch(() => null);

  const userId =
    typeof body?.userId === "string"
      ? body.userId
      : "";

  const fundingCurrency =
    body?.fundingCurrency === "USDC"
      ? "USDC"
      : "USD";

  const availableCash =
    typeof body?.availableCash === "number"
      ? body.availableCash
      : 0;

  const deployPct =
    typeof body?.deployPct === "number"
      ? body.deployPct
      : 20;

  const minCash =
    typeof body?.minCash === "number"
      ? body.minCash
      : 10;

  const minBuy =
    typeof body?.minBuy === "number"
      ? body.minBuy
      : 10;

  if (!userId) {
    return json(400, {
      ok: false,
      error: "missing_user_id",
    });
  }

  const plan =
    await buildClientPortfolioPlan({
      userId,
      fundingCurrency,
      allocationPolicy: {
        availableCash,
        deployPct,
        minCash,
        minBuy,
      },
    });

  if (
    !plan.portfolioPlanId ||
    !plan.portfolioPlan
  ) {
    return json(200, {
      ok: true,
      status: "blocked",
      reason:
        "portfolio_plan_not_ready",
      plan,
    });
  }

  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const approval =
    await createAtlasApproval(
      {
        userId: plan.userId,
        portfolioPlanId:
          plan.portfolioPlanId,
        reason:
          "Atlas multi-asset portfolio approval required.",
      },
      approvalRepository
    );

  return json(200, {
    ok: true,
    status: "approval_required",
    plan,
    approval,
  });
}