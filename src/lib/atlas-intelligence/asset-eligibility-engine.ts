/**
 * ============================================================
 * Atlas Intelligence
 * Asset Eligibility Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Determine whether an asset is eligible for production,
 * shadow-only intelligence, or is currently ineligible.
 *
 * This engine NEVER executes trades.
 *
 * SAFETY
 * - Read-only
 * - Pure calculation
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Coinbase imports
 * - No Recon imports
 * - No APIs
 * - No database
 * ============================================================
 */

import type { SupportedAsset } from "./types";
import { getAssetCapability } from "./asset-capabilities";

export type AssetEligibility =
  | "PRODUCTION"
  | "SHADOW_ONLY"
  | "INELIGIBLE";

export interface AssetEligibilityResult {
  asset: SupportedAsset;
  eligibility: AssetEligibility;
  productionReady: boolean;
  shadowSupported: boolean;
}

export function determineAssetEligibility(
  asset: SupportedAsset
): AssetEligibilityResult {
  const capability = getAssetCapability(asset);

  if (!capability) {
    return {
      asset,
      eligibility: "INELIGIBLE",
      productionReady: false,
      shadowSupported: false,
    };
  }

  if (capability.productionReady) {
    return {
      asset,
      eligibility: "PRODUCTION",
      productionReady: true,
      shadowSupported: capability.shadowSupported,
    };
  }

  if (capability.shadowSupported) {
    return {
      asset,
      eligibility: "SHADOW_ONLY",
      productionReady: false,
      shadowSupported: true,
    };
  }

  return {
    asset,
    eligibility: "INELIGIBLE",
    productionReady: false,
    shadowSupported: false,
  };
}