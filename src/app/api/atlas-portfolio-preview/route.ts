import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { buildClientPortfolioPlan } from "@/lib/atlas-intelligence/portfolio-plan-service";
import { buildAtlasExecutionInstructions } from "@/lib/atlas-execution-adapter";

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
        setAll() {},
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();

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

  const { data, error } = await supabase
    .from("entitlements")
    .select("atlas")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("atlas_entitlement_check_failed");
  }

  return data?.atlas === true;
}

async function getAtlasAvailableCash(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return 0;
  }

  const balanceUrl = new URL(
    "/api/coinbase/balances?product=atlas",
    req.url
  );

  const response = await fetch(balanceUrl, {
    cache: "no-store",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    return 0;
  }

  const data = await response.json();

  if (!data?.ok) {
    return 0;
  }

  return Number(data.available_usd ?? 0);
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

  const availableCash = await getAtlasAvailableCash(req);

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