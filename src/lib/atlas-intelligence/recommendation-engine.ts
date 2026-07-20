/**
 * ============================================================
 * Atlas Intelligence
 * Recommendation Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Produces read-only asset recommendations using the existing
 * Atlas registries and Compatibility Engine.
 *
 * SAFETY
 * - Read-only
 * - No execution
 * - No Coinbase SDK
 * - No Pulse imports
 * - No Atlas execution imports
 * - No API calls
 * - No database writes
 * - No credentials
 * - Pure deterministic logic
 * ============================================================
 */

import { ATLAS_ASSET_REGISTRY } from "./asset-registry";
import {
  ATLAS_BROKER_REGISTRY,
  type AtlasBroker,
} from "./broker-registry";
import {
  AtlasCompatibilityEngine,
  type CompatibilityReason,
  type CompatibilityResult,
} from "./compatibility-engine";
import type { SupportedAsset } from "./types";

export interface AtlasBrokerRecommendationEvaluation {
  broker: AtlasBroker;
  result: CompatibilityResult;
}

export interface AtlasAssetRecommendation {
  asset: SupportedAsset;
  compatible: boolean;
  productionReady: boolean;
  supportedBrokers: AtlasBroker[];
  reasons: CompatibilityReason[];
  brokerEvaluations: AtlasBrokerRecommendationEvaluation[];
}

function uniqueReasons(
  reasons: CompatibilityReason[],
): CompatibilityReason[] {
  return Array.from(new Set(reasons));
}

export class AtlasRecommendationEngine {
  static evaluateAsset(
    asset: SupportedAsset,
  ): AtlasAssetRecommendation {
    const brokerEvaluations =
      ATLAS_BROKER_REGISTRY.map(
        ({ broker }): AtlasBrokerRecommendationEvaluation => ({
          broker,
          result: AtlasCompatibilityEngine.evaluate(broker, asset),
        }),
      );

    const compatibleEvaluations = brokerEvaluations.filter(
      ({ result }) => result.compatible,
    );

    const supportedBrokers = compatibleEvaluations.map(
      ({ broker }) => broker,
    );

    const productionReady = compatibleEvaluations.some(
      ({ result }) => result.productionReady,
    );

    const reasons =
      compatibleEvaluations.length > 0
        ? uniqueReasons(
            compatibleEvaluations.map(({ result }) => result.reason),
          )
        : uniqueReasons(
            brokerEvaluations.map(({ result }) => result.reason),
          );

    return {
      asset,
      compatible: supportedBrokers.length > 0,
      productionReady,
      supportedBrokers,
      reasons,
      brokerEvaluations,
    };
  }

  static getAvailableAssets(): SupportedAsset[] {
    return ATLAS_ASSET_REGISTRY.filter(
      ({ enabled }) => enabled,
    ).map(({ symbol }) => symbol);
  }

  static getAvailableBrokers(): AtlasBroker[] {
    return ATLAS_BROKER_REGISTRY.filter(
      ({ enabled }) => enabled,
    ).map(({ broker }) => broker);
  }
}