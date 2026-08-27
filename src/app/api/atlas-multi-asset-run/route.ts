/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Intelligence Governance Run
 * ------------------------------------------------------------
 * PURPOSE
 * Resolve authoritative per-client Coinbase USD funding,
 * commit 100% of genuinely unprocessed Atlas cash into the
 * client's saved target allocation, persist pending capital,
 * evaluate real market conditions through isolated Multi-Asset
 * intelligence, persist the intelligence-approved deterministic
 * portfolio plan, and advance it through governance.
 *
 * CORE RULES
 * - 100% of genuinely new Atlas cash becomes portfolio capital
 * - Client allocation remains authoritative
 * - Intelligence controls BUY timing/staging only
 * - Intelligence cannot redirect dollars between assets
 * - Atlas never creates SELL instructions
 * - Pending capital remains assigned when intelligence waits
 *
 * SAFETY
 * - Operator controlled
 * - Client allocation driven
 * - Per-client Atlas Coinbase funding read
 * - Multi-Asset state tables only
 * - Same observed cash cannot be allocated repeatedly
 * - Intelligence-approved plan is what governance authorizes
 * - Deterministic plan identity
 * - Existing approval state machine
 * - Existing authorization state machine
 * - No execution dispatch
 * - No Coinbase order submission
 * - No Pulse
 * - No Recon
 * - Does not modify legacy Atlas BTC
 * ============================================================
 */

import {
  NextResponse,
} from "next/server";

import crypto from "crypto";

import {
  getClientAllocationPlan,
} from "@/lib/repositories/clientAllocationRepository";

import {
  saveAtlasPortfolioPlan,
} from "@/lib/repositories/atlasPortfolioPlanRepository";

import {
  governAtlasMultiAssetPlan,
} from "@/lib/atlas-multi-asset-orchestrator";

import {
  getAtlasClientFundingBalance,
} from "@/lib/atlas-client-coinbase-balance";

import {
  processAtlasMultiAssetAccumulation,
} from "@/lib/atlas-multi-asset-state-service";

import {
  buildAtlasPendingPortfolioPlan,
} from "@/lib/atlas-multi-asset-pending-plan";

import {
  buildAtlasMultiAssetIntelligencePlan,
} from "@/lib/atlas-multi-asset-intelligence/intelligence-plan";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


function json(
  status: number,
  body: unknown
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}


/**
 * Produce stable JSON so object-key ordering cannot change
 * deterministic portfolio identity.
 */
function canonicalize(
  value: unknown
): unknown {
  if (
    value === null ||
    typeof value !==
      "object"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      canonicalize
    );
  }

  const input =
    value as
      Record<
        string,
        unknown
      >;

  const output:
    Record<
      string,
      unknown
    > =
      {};

  for (
    const key
    of Object.keys(
      input
    ).sort()
  ) {
    output[key] =
      canonicalize(
        input[key]
      );
  }

  return output;
}


/**
 * Same user + same intelligence-approved plan contents
 * => same portfolioPlanId.
 *
 * Any material intelligence-approved plan change
 * => different portfolioPlanId.
 */
function createDeterministicPortfolioPlanId(
  userId: string,
  portfolioPlan: unknown
): string {
  const canonicalPayload =
    JSON.stringify(
      canonicalize({
        scope:
          "atlas_multi_asset",

        userId,

        portfolioPlan,
      })
    );

  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        canonicalPayload
      )
      .digest(
        "hex"
      );

  /*
   * UUID-shaped deterministic value.
   *
   * Version nibble = 5
   * Variant nibble = 8
   */
  const uuidHex =
    (
      digest.slice(
        0,
        12
      ) +
      "5" +
      digest.slice(
        13,
        16
      ) +
      "8" +
      digest.slice(
        17,
        32
      )
    );

  return [
    uuidHex.slice(
      0,
      8
    ),

    uuidHex.slice(
      8,
      12
    ),

    uuidHex.slice(
      12,
      16
    ),

    uuidHex.slice(
      16,
      20
    ),

    uuidHex.slice(
      20,
      32
    ),
  ].join(
    "-"
  );
}


function okAuth(
  req: Request
) {
  const secret =
    process.env
      .ATLAS_MULTI_ASSET_RUN_SECRET
      ?.trim() ||
    process.env
      .ATLAS_RUN_SECRET
      ?.trim() ||
    process.env
      .CRON_SECRET
      ?.trim() ||
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
    header ===
      `Bearer ${secret}`
  ) {
    return true;
  }

  const url =
    new URL(
      req.url
    );

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
    /*
     * ========================================================
     * AUTH
     * ========================================================
     */

    if (
      !okAuth(
        req
      )
    ) {
      return json(
        401,
        {
          ok: false,

          error:
            "Unauthorized",
        }
      );
    }


    /*
     * ========================================================
     * REQUEST
     * ========================================================
     */

    const body =
      await req
        .json()
        .catch(
          () =>
            null
        );

    if (
      typeof body !==
        "object" ||
      body ===
        null
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


    const userId =
      typeof userIdValue ===
        "string"
        ? userIdValue.trim()
        : "";


    /*
     * Compatibility values.
     *
     * deployPct no longer reduces Multi-Asset capital
     * accounting.
     *
     * minCash no longer blocks accumulation.
     *
     * minBuy remains the execution-readiness minimum.
     */
    const deployPct =
      typeof deployPctValue ===
        "number"
        ? deployPctValue
        : 100;


    const minCash =
      typeof minCashValue ===
        "number"
        ? minCashValue
        : 0;


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
      deployPct <=
        0 ||
      deployPct >
        100
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
      minCash <
        0
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
      minBuy <=
        0
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
     * ========================================================
     * 1. AUTHORITATIVE CLIENT FUNDING
     * ========================================================
     */

    let funding;


    try {
      funding =
        await getAtlasClientFundingBalance(
          userId
        );

    } catch (
      error
    ) {
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
      availableCash <
        0
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


    const fundingSummary = {
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
    };


    /*
     * There is intentionally NO pre-accumulation minCash gate.
     *
     * Even small verified balances belong in portfolio state.
     */


    /*
     * ========================================================
     * 2. AUTHORITATIVE CLIENT ALLOCATION
     * ========================================================
     */

    const allocationRows =
      await getClientAllocationPlan(
        userId
      );


    if (
      allocationRows.length ===
        0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "no_client_allocation",

          funding:
            fundingSummary,
        }
      );
    }


    /*
     * ========================================================
     * 3. PERSISTENT 100% CAPITAL ACCUMULATION
     * ========================================================
     */

    const accumulation =
      await processAtlasMultiAssetAccumulation({
        userId,

        currentCashUsd:
          availableCash,

        deployPct,

        minOrderUsd:
          minBuy,

        allocationRows,
      });


    if (
      !accumulation
        .accumulation
        .valid
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            accumulation
              .accumulation
              .reason,

          funding:
            fundingSummary,

          accumulation,
        }
      );
    }


    /*
     * ========================================================
     * 4. BASE PENDING PORTFOLIO PLAN
     * ========================================================
     *
     * This represents the complete committed pending portfolio.
     *
     * Intelligence has NOT reduced/staged anything yet.
     */

    const basePortfolioPlan =
      buildAtlasPendingPortfolioPlan({
        buckets:
          accumulation
            .accumulation
            .buckets,

        fundingCurrency:
          "USD",

        minOrderUsd:
          minBuy,
      });


    if (
      !basePortfolioPlan.valid
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            "portfolio_plan_invalid",

          funding:
            fundingSummary,

          accumulation,

          basePortfolioPlan,
        }
      );
    }


    /*
     * ========================================================
     * 5. ISOLATED MULTI-ASSET INTELLIGENCE
     * ========================================================
     *
     * Reads market observations and determines BUY_NOW,
     * SCALE_IN, WAIT, or BLOCK for each pending asset.
     *
     * No execution occurs here.
     */

    const intelligencePlan =
  await buildAtlasMultiAssetIntelligencePlan({
    userId,

    basePlan:
      basePortfolioPlan,

    minOrderUsd:
      minBuy,
  });


    if (
      !intelligencePlan.valid
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "blocked",

          reason:
            intelligencePlan.reason,

          funding:
            fundingSummary,

          accumulation,

          intelligence:
            intelligencePlan,
        }
      );
    }


    /*
     * The intelligence-approved plan is now THE plan that may
     * advance through governance.
     *
     * Governance can never authorize amounts different from
     * what intelligence approved during this cycle.
     */

    const portfolioPlan =
      intelligencePlan
        .approvedPlan;


    const executableOrders =
      portfolioPlan
        .orders
        .filter(
          (
            order
          ) =>
            order.executable &&
            Boolean(
              order.productId
            ) &&
            order.proposedBuyUsd >=
              minBuy
        );


    /*
     * No intelligence-approved entry this cycle.
     *
     * Persistent pending capital is NOT deleted or redirected.
     * It remains assigned and will be evaluated again later.
     */
    if (
      executableOrders.length ===
        0
    ) {
      return json(
        200,
        {
          ok: true,

          status:
            "intelligence_wait",

          reason:
            "no_intelligence_approved_orders",

          funding:
            fundingSummary,

          accounting: {
            model:
              "full_capital_commitment",

            newCashCommitmentPct:
              100,

            minCashBlocksAccumulation:
              false,

            minBuyUsd:
              minBuy,
          },

          accumulation,

          intelligence:
            intelligencePlan,

          execution:
            "NOT_CALLED",

          coinbaseOrdersSubmitted:
            0,
        }
      );
    }


    /*
     * ========================================================
     * 6. DETERMINISTIC INTELLIGENCE-APPROVED PLAN ID
     * ========================================================
     *
     * We fingerprint the exact plan intelligence approved,
     * including staged dollar amounts.
     */

    const portfolioPlanId =
      createDeterministicPortfolioPlanId(
        userId,
        portfolioPlan
      );


    /*
     * Persist EXACTLY the intelligence-approved plan.
     *
     * The protected execution route later reloads this persisted
     * plan. It cannot create caller-supplied instructions.
     */
    await saveAtlasPortfolioPlan({
      portfolioPlanId,

      userId,

      plan:
        portfolioPlan,
    });


    /*
     * ========================================================
     * 7. GOVERNANCE
     * ========================================================
     *
     * Existing deterministic approval/authorization system.
     *
     * STILL NO EXECUTION HERE.
     */

    const governance =
      await governAtlasMultiAssetPlan({
        userId,

        portfolioPlanId,
      });


    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return json(
      200,
      {
        ok:
          true,

        status:
          "authorized_ready",

        funding:
          fundingSummary,

        accounting: {
          model:
            "full_capital_commitment",

          newCashCommitmentPct:
            100,

          minCashBlocksAccumulation:
            false,

          minBuyUsd:
            minBuy,
        },

        accumulation,

        intelligence: {
          valid:
            intelligencePlan.valid,

          reason:
            intelligencePlan.reason,

          portfolio:
            intelligencePlan.intelligence,

          observations:
            intelligencePlan.observations,

          basePlan:
            intelligencePlan.basePlan,

          approvedPlan:
            intelligencePlan.approvedPlan,
        },

        plan: {
          userId,

          portfolioPlanId,

          deterministic:
            true,

          intelligenceApproved:
            true,

          allocationRows,

          portfolioPlan,
        },

        governance,

        /*
         * Execution remains deliberately separate.
         *
         * The already-proven protected executor consumes only
         * this persisted + approved + authorized plan.
         */
        execution:
          "NOT_CALLED",

        coinbaseOrdersSubmitted:
          0,
      }
    );

  } catch (
    error
  ) {
    return json(
      500,
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "unknown_error",

        execution:
          "NOT_CALLED",

        coinbaseOrdersSubmitted:
          0,
      }
    );
  }
}