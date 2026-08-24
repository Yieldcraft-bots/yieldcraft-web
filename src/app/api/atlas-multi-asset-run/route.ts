/**
 * ============================================================
 * YieldCraft Atlas
 * Multi Asset Governance Run
 * ------------------------------------------------------------
 * PURPOSE
 * Build a client-selected Atlas portfolio plan using
 * authoritative per-client Coinbase USD funding and advance it
 * through the existing approval and authorization boundaries.
 *
 * SAFETY
 * - Operator controlled
 * - Client allocation driven
 * - Per-client Atlas Coinbase credentials
 * - Read-only Coinbase balance access
 * - Uses existing approval state machine
 * - Uses existing authorization state machine
 * - No execution dispatch
 * - No Coinbase order submission
 * - No Pulse
 * - No Recon
 * - No trading
 * - Does not modify legacy Atlas BTC execution
 *
 * IMPORTANT
 * availableCash is NOT accepted from the caller.
 *
 * Atlas resolves the client's authoritative Coinbase USD
 * available balance itself.
 *
 * USDC is reported separately and is NOT automatically counted
 * as deployable USD.
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

import {
  getAtlasClientFundingBalance,
} from "@/lib/atlas-client-coinbase-balance";


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
    process.env.ATLAS_MULTI_ASSET_RUN_SECRET?.trim() ||
    process.env.ATLAS_RUN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";


  if (!secret) {
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


    const userIdValue =
      Reflect.get(
        body,
        "userId"
      );


    const userId =
      typeof userIdValue === "string"
        ? userIdValue.trim()
        : "";


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
     * Resolve authoritative funding directly from this
     * client's Atlas-scoped Coinbase credentials.
     *
     * The caller cannot provide availableCash.
     *
     * This is READ-ONLY Coinbase access.
     */
    let funding;


    try {

      funding =
        await getAtlasClientFundingBalance(
          userId
        );

    } catch (error) {

      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "coinbase_funding_unverified",

          error:
            error instanceof Error
              ? error.message
              : "unknown_funding_error",
        }
      );
    }


    const availableCash =
      funding.deployableCashUsd;


    if (
      !Number.isFinite(
        availableCash
      ) ||
      availableCash < 0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "coinbase_funding_invalid",
        }
      );
    }


    /*
     * Build the persisted multi-asset portfolio plan
     * from:
     *
     * - this client's saved allocation
     * - this client's authoritative Coinbase USD balance
     *
     * USDC remains separate and is not automatically
     * counted as deployable USD.
     */
    const plan =
      await buildClientPortfolioPlan({
        userId,

        fundingCurrency:
          "USD",

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

          funding: {
            usdAvailable:
              funding.usdAvailable,

            usdcAvailable:
              funding.usdcAvailable,

            deployableCashUsd:
              funding.deployableCashUsd,

            checkedAt:
              funding.checkedAt,
          },

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

          funding: {
            usdAvailable:
              funding.usdAvailable,

            usdcAvailable:
              funding.usdcAvailable,

            deployableCashUsd:
              funding.deployableCashUsd,

            checkedAt:
              funding.checkedAt,
          },

          plan,
        }
      );
    }


    /*
     * Advance the persisted plan through the
     * existing Atlas approval + authorization
     * state machines.
     *
     * Still:
     *
     * NO Coinbase order submission.
     * NO execution dispatch.
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

        funding: {
          source:
            "coinbase_atlas_client",

          currency:
            "USD",

          usdAvailable:
            funding.usdAvailable,

          usdcAvailable:
            funding.usdcAvailable,

          deployableCashUsd:
            funding.deployableCashUsd,

          checkedAt:
            funding.checkedAt,
        },

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