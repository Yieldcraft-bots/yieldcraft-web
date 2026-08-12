import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { buildClientPortfolioPlan } from "@/lib/atlas-intelligence/portfolio-plan-service";
import { buildAtlasExecutionInstructions } from "@/lib/atlas-execution-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================
 * Atlas Portfolio Preview
 *
 * PURPOSE
 * Build and return a read-only preview of the client's
 * previously selected Atlas allocation plan.
 *
 * SAFETY
 *
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

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function authenticateRequest() {
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
          // Preview route does not modify auth cookies.
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

async function hasAtlasEntitlement(userId: string) {
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
        setAll() {},
      },
    }
  );

  const {
    data,
    error,
  } = await supabase
    .from("entitlements")
    .select("atlas")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("atlas_entitlement_check_failed");
  }

  return data?.atlas === true;
}

export async function GET(req: Request) {
  const userId = await authenticateRequest();

  if (!userId) {
    return json(401, {
      ok: false,
      reason: "not_authenticated",
    });
  }

  const atlasEnabled = await hasAtlasEntitlement(userId);

  if (!atlasEnabled) {
    return json(200, {
      ok: true,
      preview: true,
      status: "blocked",
      reason: "atlas_entitlement_required",
    });
  }

  const url = new URL(req.url);

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