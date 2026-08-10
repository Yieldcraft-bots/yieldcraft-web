import {
  supabaseAdmin,
} from "../supabaseAdmin";

import type {
  PortfolioExecutionPlan,
} from "../portfolio-execution-planner";

export type AtlasPortfolioPlanRecord = {
  portfolioPlanId: string;
  userId: string;
  plan: PortfolioExecutionPlan;
};

export async function saveAtlasPortfolioPlan(
  record: AtlasPortfolioPlanRecord
): Promise<void> {
  const supabase = supabaseAdmin();

  const { error } =
    await supabase
      .from("atlas_portfolio_plans")
      .upsert(
        {
          portfolio_plan_id:
            record.portfolioPlanId,

          user_id:
            record.userId,

          valid:
            record.plan.valid,

          reason:
            record.plan.reason,

          deployable_usd:
            record.plan.deployableUsd,

          allocation_total_percent:
            record.plan.allocationTotalPercent,

          planned_usd:
            record.plan.plannedUsd,

          unplanned_usd:
            record.plan.unplannedUsd,

          orders:
            record.plan.orders,

        },
        {
          onConflict:
            "portfolio_plan_id",
        }
      );

  if (error) {
    throw error;
  }
}

export async function loadAtlasPortfolioPlan(
  portfolioPlanId: string
): Promise<AtlasPortfolioPlanRecord | null> {
  const supabase = supabaseAdmin();

  const { data, error } =
    await supabase
      .from("atlas_portfolio_plans")
      .select("*")
      .eq(
        "portfolio_plan_id",
        portfolioPlanId
      )
      .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw error;
  }

  return {
    portfolioPlanId:
      data.portfolio_plan_id,

    userId:
      data.user_id,

    plan: {
      valid:
        data.valid,

      reason:
        data.reason,

      deployableUsd:
        Number(data.deployable_usd),

      allocationTotalPercent:
        Number(data.allocation_total_percent),

      plannedUsd:
        Number(data.planned_usd),

      unplannedUsd:
        Number(data.unplanned_usd),

      orders:
        data.orders,
    },
  };
}