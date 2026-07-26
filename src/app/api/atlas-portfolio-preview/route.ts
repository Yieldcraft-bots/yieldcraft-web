import { NextResponse } from "next/server";

import { buildClientPortfolioPlan } from "@/lib/atlas-intelligence/portfolio-plan-service";
import { buildAtlasExecutionInstructions } from "@/lib/atlas-execution-adapter";
import { createAtlasApproval } from "@/lib/atlas-operations";

import { SupabaseAtlasApprovalRepository } from "@/lib/repositories/atlasApprovalRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_user_id",
      },
      { status: 400 }
    );
  }

  const availableCash = Number(
    url.searchParams.get("availableCash") ?? "0"
  );

  const deployPct = Number(
    url.searchParams.get("deployPct") ?? "20"
  );

  const minBuy = Number(
    url.searchParams.get("minBuy") ?? "10"
  );

  const fundingCurrency =
    (url.searchParams.get("fundingCurrency") as
      | "USD"
      | "USDC") ?? "USD";

  const plan = await buildClientPortfolioPlan({
    userId,
    fundingCurrency,
    allocationPolicy: {
      availableCash,
      deployPct,
      minCash: minBuy,
      minBuy,
    },
  });

  const approvalRepository =
    new SupabaseAtlasApprovalRepository();

  const approval =
    plan.portfolioPlanId === null
      ? null
      : await createAtlasApproval(
          {
            userId: plan.userId,
            portfolioPlanId: plan.portfolioPlanId,
            reason:
              "Portfolio preview approval required.",
          },
          approvalRepository
        );

  const execution =
    plan.portfolioPlan === null
      ? null
      : buildAtlasExecutionInstructions(
          plan.portfolioPlan
        );

  return NextResponse.json({
    ok: true,
    preview: true,
    plan,
    approval,
    execution,
  });
}