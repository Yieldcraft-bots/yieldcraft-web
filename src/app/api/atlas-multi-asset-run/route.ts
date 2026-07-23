import { NextResponse } from "next/server";
import {
  buildPortfolioExecutionPlan,
} from "@/lib/portfolio-execution-planner";
import {
  buildAtlasExecutionInstructions,
} from "@/lib/atlas-execution-adapter";

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

  const plan = buildPortfolioExecutionPlan({
    deployableUsd: 100,
    fundingCurrency: "USD",
    allocations: [
      {
        symbol: "BTC",
        targetPercent: 40,
      },
      {
        symbol: "ETH",
        targetPercent: 30,
      },
      {
        symbol: "SOL",
        targetPercent: 20,
      },
      {
        symbol: "XRP",
        targetPercent: 10,
      },
    ],
  });

  const execution = buildAtlasExecutionInstructions(plan);

  return json(200, {
    ok: true,
    plannerValid: plan.valid,
    executable: execution.executable,
    instructionCount: execution.instructions.length,
    blockedCount: execution.blocked.length,
    instructions: execution.instructions,
    blocked: execution.blocked,
  });
}