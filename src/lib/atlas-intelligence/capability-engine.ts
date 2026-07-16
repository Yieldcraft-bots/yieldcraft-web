/**
 * ============================================================
 * Atlas Intelligence
 * Asset Capability Engine
 * ------------------------------------------------------------
 * PURPOSE
 * Determine whether an asset is operationally available for
 * Atlas Intelligence based on:
 *
 * - Atlas registry status
 * - Connected account capabilities
 * - Connected platform asset support
 *
 * SAFETY
 * - Read-only
 * - No trading
 * - No allocation decisions
 * - No investment recommendations
 * - No Coinbase API calls
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 *
 * Atlas never decides what a client should own.
 * It only checks whether a client-selected asset can be
 * supported by the connected account and platform.
 * ============================================================
 */

import type { AtlasAssetDefinition } from "./types";

export type AccountCapability = {
  cryptoTradingEnabled: boolean;
  stockTradingEnabled: boolean;
  privateMarketTradingEnabled: boolean;
  supportedSymbols: readonly string[];
};

export type AssetCapabilityStatus =
  | "AVAILABLE"
  | "ASSET_DISABLED"
  | "COMING_SOON"
  | "ACCOUNT_SETUP_REQUIRED"
  | "PLATFORM_NOT_SUPPORTED"
  | "ASSET_NOT_FOUND";

export type AssetCapabilityResult = {
  symbol: string;
  available: boolean;
  status: AssetCapabilityStatus;
  reason: string;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function accountSupportsAssetClass(
  asset: AtlasAssetDefinition,
  capability: AccountCapability
): boolean {
  switch (asset.assetClass) {
    case "CRYPTO":
      return capability.cryptoTradingEnabled;

    case "STOCK":
    case "ETF":
      return capability.stockTradingEnabled;

    case "PRIVATE":
      return capability.privateMarketTradingEnabled;

    default:
      return false;
  }
}

export function evaluateAssetCapability(
  symbol: string,
  assetRegistry: readonly AtlasAssetDefinition[],
  accountCapability: AccountCapability
): AssetCapabilityResult {
  const normalizedSymbol = normalizeSymbol(symbol);

  const asset = assetRegistry.find(
    (candidate) => normalizeSymbol(candidate.symbol) === normalizedSymbol
  );

  if (!asset) {
    return {
      symbol: normalizedSymbol,
      available: false,
      status: "ASSET_NOT_FOUND",
      reason: "The asset is not present in the Atlas asset registry.",
    };
  }

  if (asset.status === "DISABLED") {
    return {
      symbol: asset.symbol,
      available: false,
      status: "ASSET_DISABLED",
      reason: "The asset is disabled in Atlas Intelligence.",
    };
  }

  if (asset.status === "COMING_SOON" || !asset.enabled) {
    return {
      symbol: asset.symbol,
      available: false,
      status: "COMING_SOON",
      reason:
        "Atlas understands this asset, but it is not enabled for operational use.",
    };
  }

  if (!accountSupportsAssetClass(asset, accountCapability)) {
    return {
      symbol: asset.symbol,
      available: false,
      status: "ACCOUNT_SETUP_REQUIRED",
      reason:
        "The connected account does not currently have the required trading capability enabled for this asset class.",
    };
  }

  const supportedSymbols = accountCapability.supportedSymbols.map(
    normalizeSymbol
  );

  if (!supportedSymbols.includes(normalizedSymbol)) {
    return {
      symbol: asset.symbol,
      available: false,
      status: "PLATFORM_NOT_SUPPORTED",
      reason:
        "The connected platform does not currently report support for this asset.",
    };
  }

  return {
    symbol: asset.symbol,
    available: true,
    status: "AVAILABLE",
    reason:
      "The asset is enabled in Atlas Intelligence and supported by the connected account and platform.",
  };
}