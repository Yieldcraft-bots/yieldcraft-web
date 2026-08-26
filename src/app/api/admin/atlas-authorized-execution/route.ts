import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";

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

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Missing env: ${name}`);
  }

  return value.trim();
}

function supabaseService() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const authorized =
      await isAuthorizedAdminRequest(request);

    if (!authorized) {
      return json(401, {
        ok: false,
        status: "UNAUTHORIZED",
        error: "Admin authorization is required.",
      });
    }

    const supabase = supabaseService();

    const { data: authorizations, error: authorizationError } =
      await supabase
        .from("atlas_execution_authorizations")
        .select(
          "authorization_id,approval_id,user_id,portfolio_plan_id,status,authorized_at,created_at"
        )
        .eq("status", "AUTHORIZED")
        .order("created_at", {
          ascending: false,
        })
        .limit(25);

    if (authorizationError) {
      throw authorizationError;
    }

    if (!authorizations?.length) {
      return json(409, {
        ok: false,
        status: "NO_AUTHORIZED_PLAN",
        error:
          "No authorized Atlas portfolio plan is currently available.",
      });
    }

    for (const authorization of authorizations) {
      const [approvalResult, planResult] =
        await Promise.all([
          supabase
            .from("atlas_approvals")
            .select(
              "approval_id,user_id,portfolio_plan_id,status,approved_at"
            )
            .eq(
              "approval_id",
              authorization.approval_id
            )
            .maybeSingle(),

          supabase
            .from("atlas_portfolio_plans")
            .select(
              "portfolio_plan_id,user_id,valid,reason,deployable_usd,planned_usd,unplanned_usd,orders,created_at"
            )
            .eq(
              "portfolio_plan_id",
              authorization.portfolio_plan_id
            )
            .maybeSingle(),
        ]);

      if (approvalResult.error) {
        throw approvalResult.error;
      }

      if (planResult.error) {
        throw planResult.error;
      }

      const approval = approvalResult.data;
      const plan = planResult.data;

      if (!approval || !plan) {
        continue;
      }

      if (approval.status !== "APPROVED") {
        continue;
      }

      if (
        approval.user_id !== authorization.user_id ||
        approval.portfolio_plan_id !==
          authorization.portfolio_plan_id
      ) {
        continue;
      }

      if (
        plan.user_id !== authorization.user_id ||
        plan.valid !== true
      ) {
        continue;
      }

      const orders = Array.isArray(plan.orders)
        ? plan.orders
        : [];

      const executableOrders = orders.filter(
        (order: any) =>
          order?.executable === true &&
          typeof order?.productId === "string" &&
          Number(order?.proposedBuyUsd) > 0
      );

      if (executableOrders.length === 0) {
        continue;
      }

      return json(200, {
        ok: true,
        status: "AUTHORIZED_READY",
        message:
          "Atlas has a persisted approved and authorized portfolio plan ready at the execution boundary.",
        authorization: {
          authorizationId:
            authorization.authorization_id,
          approvalId:
            authorization.approval_id,
          userId:
            authorization.user_id,
          portfolioPlanId:
            authorization.portfolio_plan_id,
          authorizedAt:
            authorization.authorized_at,
        },
        plan: {
          deployableUsd: Number(
            plan.deployable_usd
          ),
          plannedUsd: Number(plan.planned_usd),
          unplannedUsd: Number(
            plan.unplanned_usd
          ),
          executableOrders,
        },
        execution: "NOT_CALLED",
      });
    }

    return json(409, {
      ok: false,
      status: "NO_EXECUTABLE_AUTHORIZED_PLAN",
      error:
        "Authorized records exist, but none currently resolve to a valid approved portfolio plan with executable instructions.",
    });
  } catch (error) {
    return json(500, {
      ok: false,
      status:
        "ATLAS_AUTHORIZED_EXECUTION_READ_ERROR",
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}