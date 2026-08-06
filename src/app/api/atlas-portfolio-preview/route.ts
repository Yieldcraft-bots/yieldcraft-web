import { NextResponse } from "next/server";

import { buildClientPortfolioPlan } from "@/lib/atlas-intelligence/portfolio-plan-service";
import { buildAtlasExecutionInstructions } from "@/lib/atlas-execution-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================
 * Atlas Portfolio Preview
 * ------------------------------------------------------------
 * PURPOSE
 * Build and return a read-only preview of the client's
 * previously selected Atlas allocation plan.
 *
 * SAFETY
 * - Preview only
 * - No approval creation
 * - No approval persistence
 * - No authorization
 * - No order submission
 * - No Coinbase access
 * - No Pulse
 * - No Recon
 * - No trading
 *
 * Execution instructions returned here are descriptive planning
 * output only. They are NOT dispatched or submitted.
 * ============================================================
 */

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
    execution,
  });
}