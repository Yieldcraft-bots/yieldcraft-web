/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Intelligence-Approved Portfolio Plan V1
 * ------------------------------------------------------------
 * PURPOSE
 * Take an already-built Atlas Multi-Asset pending portfolio
 * plan, observe real market conditions, apply isolated entry
 * intelligence, and return an intelligence-approved plan for
 * governance/shadow validation.
 *
 * CORE RULES
 * - Client allocation remains authoritative.
 * - Never redirect one asset's dollars to another.
 * - Never recommend more than existing pending capital.
 * - BUY-only accumulation decisions.
 * - Waiting capital remains in pending state.
 * - Existing execution infrastructure is not modified.
 *
 * SAFETY
 * - Atlas Multi-Asset only
 * - No credentials
 * - No Supabase
 * - No order submission
 * - No legacy Atlas
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import type {
  PortfolioExecutionPlan,
  PortfolioExecutionPlanOrder,
} from "../portfolio-execution-planner";

import {
  observeAtlasMultiAssetMarket,
  type AtlasMultiAssetMarketObservation,
} from "./market-observation";

import {
  evaluateAtlasMultiAssetPortfolio,
  type AtlasMultiAssetPortfolioCandidate,
  type AtlasMultiAssetPortfolioDecision,
} from "./portfolio-intelligence";


export interface AtlasMultiAssetIntelligencePlanResult {
  valid: boolean;

  reason: string;

  basePlan:
    PortfolioExecutionPlan;

  intelligence:
    AtlasMultiAssetPortfolioDecision;

  observations:
    AtlasMultiAssetMarketObservation[];

  approvedPlan:
    PortfolioExecutionPlan;
}


function money(
  value: number
): number {
  return Number(
    value.toFixed(2)
  );
}


function unavailableObservation(
  order: PortfolioExecutionPlanOrder
): AtlasMultiAssetMarketObservation {
  return {
    symbol:
      order.symbol,

    productId:
      order.productId ?? "",

    observedAt:
      new Date()
        .toISOString(),

    candleCount:
      0,

    latestPrice:
      0,

    snapshot: {
      regime:
        "NEUTRAL",

      trendScore:
        0,

      momentumScore:
        0,

      pullbackQuality:
        0,

      volatilityScore:
        0,

      relativeStrengthScore:
        0,

      marketOpen:
        false,

      dataFresh:
        false,
    },
  };
}


export async function buildAtlasMultiAssetIntelligencePlan(
  input: {
    basePlan:
      PortfolioExecutionPlan;

    minOrderUsd:
      number;
  }
): Promise<AtlasMultiAssetIntelligencePlanResult> {
  const basePlan =
    input.basePlan;

  const minOrderUsd =
    money(
      input.minOrderUsd
    );

  if (
    !basePlan.valid
  ) {
    return {
      valid:
        false,

      reason:
        "base_plan_invalid",

      basePlan,

      intelligence: {
        valid:
          false,

        reason:
          "base_plan_invalid",

        totalPendingUsd:
          basePlan.deployableUsd,

        recommendedDeployUsd:
          0,

        remainingPendingUsd:
          basePlan.deployableUsd,

        executableDecisionCount:
          0,

        waitingDecisionCount:
          0,

        blockedDecisionCount:
          0,

        decisions:
          [],
      },

      observations:
        [],

      approvedPlan:
        basePlan,
    };
  }


  /*
   * Observe every order with a valid mapped Coinbase product.
   *
   * Non-executable orders remain represented in the portfolio
   * intelligence input but fail closed at execution eligibility.
   */
  const observations =
    await Promise.all(
      basePlan.orders.map(
        async (
          order
        ) => {
          if (
            !order.productId
          ) {
            return unavailableObservation(
              order
            );
          }

          return observeAtlasMultiAssetMarket({
            symbol:
              order.symbol,

            productId:
              order.productId,
          });
        }
      )
    );


  const observationBySymbol =
    new Map(
      observations.map(
        (
          observation
        ) => [
          observation.symbol
            .trim()
            .toUpperCase(),

          observation,
        ]
      )
    );


  const candidates:
    AtlasMultiAssetPortfolioCandidate[] =
      basePlan.orders.map(
        (
          order
        ) => {
          const symbol =
            order.symbol
              .trim()
              .toUpperCase();

          const observation =
            observationBySymbol.get(
              symbol
            ) ??
            unavailableObservation(
              order
            );

          return {
            symbol,

            targetPercent:
              order.targetPercent,

            pendingUsd:
              order.proposedBuyUsd,

            minOrderUsd,

            executionEligible:
              order.executable &&
              Boolean(
                order.productId
              ),

            /*
             * V1 starts at zero because wait-cycle persistence
             * has not yet been introduced into the database.
             *
             * The interface is already future-ready for that
             * isolated upgrade.
             */
            waitCycles:
              0,

            market:
              observation.snapshot,
          };
        }
      );


  const intelligence =
    evaluateAtlasMultiAssetPortfolio({
      candidates,
    });


  if (
    !intelligence.valid
  ) {
    return {
      valid:
        false,

      reason:
        intelligence.reason,

      basePlan,

      intelligence,

      observations,

      approvedPlan:
        basePlan,
    };
  }


  const decisionBySymbol =
    new Map(
      intelligence.decisions.map(
        (
          decision
        ) => [
          decision.symbol
            .trim()
            .toUpperCase(),

          decision,
        ]
      )
    );


  /*
   * Build a shadow/governance-safe derived plan.
   *
   * BUY_NOW / SCALE_IN:
   *   preserve the exact mapped product and use only the
   *   intelligence-approved amount.
   *
   * WAIT / BLOCK:
   *   mark the derived order non-executable while leaving the
   *   underlying persistent pending bucket untouched.
   *
   * The existing reason union has no intelligence-specific
   * reason yet. We therefore retain the original plan reason
   * and expose the true intelligence reason separately in the
   * intelligence decision ledger returned above.
   */
  const approvedOrders:
    PortfolioExecutionPlanOrder[] =
      basePlan.orders.map(
        (
          order
        ) => {
          const symbol =
            order.symbol
              .trim()
              .toUpperCase();

          const decision =
            decisionBySymbol.get(
              symbol
            );

          if (
            !decision ||
            !order.executable ||
            !order.productId
          ) {
            return {
              ...order,

              executable:
                false,
            };
          }


          if (
            (
              decision.action ===
                "BUY_NOW" ||
              decision.action ===
                "SCALE_IN"
            ) &&
            decision.recommendedBuyUsd >=
              minOrderUsd
          ) {
            return {
              ...order,

              proposedBuyUsd:
                money(
                  Math.min(
                    order.proposedBuyUsd,
                    decision.recommendedBuyUsd
                  )
                ),

              executable:
                true,

              reason:
                "ready",
            };
          }


          return {
            ...order,

            executable:
              false,
          };
        }
      );


  const plannedUsd =
    money(
      approvedOrders
        .filter(
          (
            order
          ) =>
            order.executable
        )
        .reduce(
          (
            total,
            order
          ) =>
            total +
            order.proposedBuyUsd,
          0
        )
    );


  const approvedPlan:
    PortfolioExecutionPlan =
      {
        valid:
          true,

        reason:
          "plan_ready",

        /*
         * Full pending capital remains the portfolio-level
         * capital responsibility.
         */
        deployableUsd:
          basePlan.deployableUsd,

        allocationTotalPercent:
          basePlan.allocationTotalPercent,

        plannedUsd,

        unplannedUsd:
          money(
            basePlan.deployableUsd -
            plannedUsd
          ),

        orders:
          approvedOrders,
      };


  return {
    valid:
      true,

    reason:
      plannedUsd >
        0
        ? "intelligence_plan_ready"
        : "intelligence_plan_waiting",

    basePlan,

    intelligence,

    observations,

    approvedPlan,
  };
}