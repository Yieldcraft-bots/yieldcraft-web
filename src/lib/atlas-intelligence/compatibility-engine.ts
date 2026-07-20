/**
 * ============================================================
 * Atlas Intelligence
 * Compatibility Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Determines compatibility between Atlas assets and brokers.
 *
 * This engine is READ ONLY.
 *
 * SAFETY
 * - No execution
 * - No Coinbase SDK
 * - No Pulse imports
 * - No Atlas execution imports
 * - No API calls
 * - No credentials
 * - Pure deterministic logic
 * ============================================================
 */

import { ATLAS_ASSET_REGISTRY } from "./asset-registry";
import { ATLAS_ASSET_CAPABILITIES } from "./asset-capabilities";
import { ATLAS_BROKER_REGISTRY } from "./broker-registry";
import { ATLAS_BROKER_CAPABILITIES } from "./broker-capabilities";
import { SupportedAsset } from "./types";
import { AtlasBroker } from "./broker-registry";

export type CompatibilityReason =
  | "COMPATIBLE"
  | "ASSET_NOT_FOUND"
  | "BROKER_NOT_FOUND"
  | "ASSET_DISABLED"
  | "BROKER_DISABLED"
  | "ASSET_CLASS_NOT_SUPPORTED"
  | "NOT_PRODUCTION_READY";

export interface CompatibilityResult {
  compatible: boolean;
  productionReady: boolean;
  reason: CompatibilityReason;
}

export class AtlasCompatibilityEngine {
  static evaluate(
    broker: AtlasBroker,
    asset: SupportedAsset,
  ): CompatibilityResult {
    const assetDefinition = ATLAS_ASSET_REGISTRY.find(
      (a) => a.symbol === asset,
    );

    if (!assetDefinition) {
      return {
        compatible: false,
        productionReady: false,
        reason: "ASSET_NOT_FOUND",
      };
    }

    const brokerDefinition = ATLAS_BROKER_REGISTRY.find(
      (b) => b.broker === broker,
    );

    if (!brokerDefinition) {
      return {
        compatible: false,
        productionReady: false,
        reason: "BROKER_NOT_FOUND",
      };
    }

    if (!assetDefinition.enabled) {
      return {
        compatible: false,
        productionReady: false,
        reason: "ASSET_DISABLED",
      };
    }

    if (!brokerDefinition.enabled) {
      return {
        compatible: false,
        productionReady: false,
        reason: "BROKER_DISABLED",
      };
    }

    const assetCapabilities = ATLAS_ASSET_CAPABILITIES.find(
      (a) => a.symbol === asset,
    );

    const brokerCapabilities = ATLAS_BROKER_CAPABILITIES.find(
      (b) => b.broker === broker,
    );

    if (
      !assetCapabilities ||
      !brokerCapabilities ||
      !brokerCapabilities.supportedAssetClasses.includes(
        assetDefinition.assetClass,
      )
    ) {
      return {
        compatible: false,
        productionReady: false,
        reason: "ASSET_CLASS_NOT_SUPPORTED",
      };
    }

    const productionReady =
      assetCapabilities.productionReady &&
      brokerCapabilities.productionReady;

    return {
      compatible: true,
      productionReady,
      reason: productionReady
        ? "COMPATIBLE"
        : "NOT_PRODUCTION_READY",
    };
  }
}