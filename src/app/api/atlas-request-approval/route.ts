import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

async function getUserId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No auth cookie changes here.
        },
      },
    }
  );

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function POST(req: Request) {
  const userId = await getUserId();

  if (!userId) {
    return json(401, {
      ok: false,
      error: "not_authenticated",
    });
  }

  const body = await req.json().catch(() => null);

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
      reason: "portfolio_plan_not_ready",
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