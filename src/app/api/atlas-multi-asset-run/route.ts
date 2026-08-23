/**
 * ============================================================
 * YieldCraft Atlas
 * Multi Asset Governance Run
 * ------------------------------------------------------------
 * PURPOSE
 * Build a client-selected Atlas portfolio plan and advance it
 * through the existing approval and authorization boundaries.
 *
 * SAFETY
 * - Operator controlled
 * - Client allocation driven
 * - Uses existing approval state machine
 * - Uses existing authorization state machine
 * - No execution dispatch
 * - No Coinbase
 * - No credential access
 * - No Pulse
 * - No Recon
 * - No trading
 * - Does not modify legacy Atlas BTC execution
 *
 * This route creates governed execution-ready state only.
 * ============================================================
 */

import { NextResponse } from "next/server";

import {
  buildClientPortfolioPlan,
} from "@/lib/atlas-intelligence/portfolio-plan-service";

import {
  governAtlasMultiAssetPlan,
} from "@/lib/atlas-multi-asset-orchestrator";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function json(
  status: number,
  body: unknown
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}


function okAuth(
  req: Request
) {
  const secret =
    process.env.ATLAS_RUN_SECRET ??
    process.env.CRON_SECRET ??
    "";


  if (!secret.trim()) {
    return false;
  }


  const header =
    req.headers.get(
      "x-atlas-run-secret"
    ) ??
    req.headers.get(
      "x-cron-secret"
    ) ??
    req.headers.get(
      "authorization"
    );


  if (
    header === secret ||
    header === `Bearer ${secret}`
  ) {
    return true;
  }


  const url =
    new URL(req.url);


  return (
    url.searchParams.get(
      "secret"
    ) === secret
  );
}


export async function POST(
  req: Request
) {

  try {

    if (!okAuth(req)) {
      return json(
        401,
        {
          ok: false,
          error: "Unauthorized",
        }
      );
    }


    const body =
      await req
        .json()
        .catch(() => null);


    if (
      typeof body !== "object" ||
      body === null
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            "invalid_request_body",
        }
      );
    }


    const userId =
      typeof Reflect.get(
        body,
        "userId"
      ) === "string"
        ? Reflect.get(
            body,
            "userId"
          ).trim()
        : "";


    const fundingCurrency =
      Reflect.get(
        body,
        "fundingCurrency"
      ) === "USDC"
        ? "USDC"
        : "USD";


    const availableCashValue =
      Reflect.get(
        body,
        "availableCash"
      );


    const deployPctValue =
      Reflect.get(
        body,
        "deployPct"
      );


    const minCashValue =
      Reflect.get(
        body,
        "minCash"
      );


    const minBuyValue =
      Reflect.get(
        body,
        "minBuy"
      );


    const availableCash =
      typeof availableCashValue ===
        "number"
        ? availableCashValue
        : 0;


    const deployPct =
      typeof deployPctValue ===
        "number"
        ? deployPctValue
        : 20;


    const minCash =
      typeof minCashValue ===
        "number"
        ? minCashValue
        : 10;


    const minBuy =
      typeof minBuyValue ===
        "number"
        ? minBuyValue
        : 10;


    if (!userId) {
      return json(
        400,
        {
          ok: false,
          error:
            "missing_user_id",
        }
      );
    }


    if (
      !Number.isFinite(
        availableCash
      ) ||
      availableCash < 0
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            "invalid_available_cash",
        }
      );
    }


    if (
      !Number.isFinite(
        deployPct
      ) ||
      deployPct <= 0 ||
      deployPct > 100
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            "invalid_deploy_percent",
        }
      );
    }


    if (
      !Number.isFinite(
        minCash
      ) ||
      minCash < 0
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            "invalid_min_cash",
        }
      );
    }


    if (
      !Number.isFinite(
        minBuy
      ) ||
      minBuy <= 0
    ) {
      return json(
        400,
        {
          ok: false,
          error:
            "invalid_min_buy",
        }
      );
    }


    /*
     * Build the persisted multi-asset portfolio plan
     * from this client's saved allocation.
     */
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
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "portfolio_plan_not_ready",

          plan,
        }
      );
    }


    if (!plan.portfolioPlan.valid) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "portfolio_plan_invalid",

          plan,
        }
      );
    }


    /*
     * Advance the persisted plan through the
     * existing Atlas approval + authorization
     * state machines.
     *
     * Still NO Coinbase and NO execution here.
     */
    const governance =
      await governAtlasMultiAssetPlan({
        userId:
          plan.userId,

        portfolioPlanId:
          plan.portfolioPlanId,
      });


    return json(
      200,
      {
        ok: true,

        status:
          "authorized_ready",

        plan,

        governance,
      }
    );

  } catch (error) {

    return json(
      500,
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "unknown_error",
      }
    );
  }
}