/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Pending Allocation Portfolio Plan Builder
 * ------------------------------------------------------------
 * PURPOSE
 * Convert persisted per-asset pending USD buckets into a
 * deterministic executable portfolio plan.
 *
 * SAFETY
 * - Multi-Asset only
 * - Pure calculation
 * - No Supabase
 * - No Coinbase calls
 * - No execution
 * - No approval mutation
 * - No authorization mutation
 * - No legacy Atlas BTC
 * - No Pulse
 * - No Recon
 * ============================================================
 */

import {
  getAtlasAsset,
} from "./atlas-assets";

import {
  getAtlasBroker,
} from "./atlas-brokers";

import type {
  PortfolioExecutionPlan,
  PortfolioExecutionPlanOrder,
} from "./portfolio-execution-planner";

import type {
  AtlasMultiAssetAccumulationBucket,
} from "./atlas-multi-asset-accumulation";


function money(
  value: number
): number {

  return Number(
    value.toFixed(2)
  );
}


export function buildAtlasPendingPortfolioPlan(
  input: {
    buckets:
      readonly AtlasMultiAssetAccumulationBucket[];

    fundingCurrency:
      "USD" | "USDC";

    minOrderUsd:
      number;
  }
): PortfolioExecutionPlan {

  const minOrderUsd =
    money(
      input.minOrderUsd
    );


  const allocationTotalPercent =
    money(
      input.buckets.reduce(
        (
          total,
          bucket
        ) =>
          total +
          bucket.targetPercent,
        0
      )
    );


  const totalPendingUsd =
    money(
      input.buckets.reduce(
        (
          total,
          bucket
        ) =>
          total +
          bucket.pendingUsd,
        0
      )
    );


  const orders:
    PortfolioExecutionPlanOrder[] =
      input.buckets.map(
        (
          bucket
        ):
          PortfolioExecutionPlanOrder => {

          const symbol =
            bucket.symbol
              .trim()
              .toUpperCase();


          const proposedBuyUsd =
            money(
              bucket.pendingUsd
            );


          const asset =
            getAtlasAsset(
              symbol
            );


          if (!asset) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                "coinbase",
              productId:
                null,
              executable:
                false,
              reason:
                "asset_not_registered",
            };
          }


          if (
            !asset.accumulationEnabled
          ) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId:
                null,
              executable:
                false,
              reason:
                "asset_accumulation_disabled",
            };
          }


          const broker =
            getAtlasBroker(
              asset.broker
            );


          if (!broker) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId:
                null,
              executable:
                false,
              reason:
                "broker_not_registered",
            };
          }


          if (!broker.enabled) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId:
                null,
              executable:
                false,
              reason:
                "broker_disabled",
            };
          }


          const brokerSupportsAsset =
            asset.assetClass ===
              "crypto"
              ? broker.supportsCrypto
              : broker.supportsStocks;


          if (
            !brokerSupportsAsset
          ) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId:
                null,
              executable:
                false,
              reason:
                asset.assetClass ===
                  "crypto"
                  ? "broker_does_not_support_crypto"
                  : "broker_does_not_support_stocks",
            };
          }


          const productId =
            input.fundingCurrency ===
              "USDC"
              ? asset.usdcPair ??
                null
              : asset.usdPair ??
                null;


          if (!productId) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId:
                null,
              executable:
                false,
              reason:
                "no_supported_quote_pair",
            };
          }


          if (
            proposedBuyUsd <
            minOrderUsd
          ) {
            return {
              symbol,
              targetPercent:
                bucket.targetPercent,
              proposedBuyUsd,
              brokerId:
                asset.broker,
              productId,
              executable:
                false,
              reason:
                "below_min_order",
            };
          }


          return {
            symbol,
            targetPercent:
              bucket.targetPercent,
            proposedBuyUsd,
            brokerId:
              asset.broker,
            productId,
            executable:
              true,
            reason:
              "ready",
          };
        }
      );


  const plannedUsd =
    money(
      orders
        .filter(
          (order) =>
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


  return {
    valid:
      allocationTotalPercent ===
      100,

    reason:
      allocationTotalPercent ===
        100
        ? "plan_ready"
        : "allocation_total_not_100",

    deployableUsd:
      totalPendingUsd,

    allocationTotalPercent,

    plannedUsd,

    unplannedUsd:
      money(
        totalPendingUsd -
        plannedUsd
      ),

    orders,
  };
}