/**
 * ============================================================
 * Atlas Intelligence
 * Asset Catalog
 * ------------------------------------------------------------
 * PURPOSE
 * Provide read-only asset discovery and catalog filtering for
 * Atlas client and intelligence experiences.
 *
 * This file determines:
 * - Which registered assets may be displayed
 * - Which registered assets may currently be allocated
 * - How registered assets are located by symbol
 *
 * IMPORTANT
 * This file does NOT:
 * - Determine client allocation percentages
 * - Persist client allocations
 * - Check connected account capabilities
 * - Execute trades
 * - Communicate with Coinbase
 * - Import Pulse, Recon, or Atlas execution systems
 *
 * Registry array order remains the presentation order until a
 * dedicated metadata ordering contract is introduced.
 * ============================================================
 */

import type { AtlasAssetDefinition } from "./types";

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Finds one asset in a supplied Atlas registry.
 *
 * Symbol matching is case-insensitive and whitespace-tolerant.
 */
export function findAtlasAsset(
  symbol: string,
  assetRegistry: readonly AtlasAssetDefinition[]
): AtlasAssetDefinition | null {
  const normalizedSymbol = normalizeSymbol(symbol);

  return (
    assetRegistry.find(
      (asset) => normalizeSymbol(asset.symbol) === normalizedSymbol
    ) ?? null
  );
}

/**
 * Determines whether an asset may be shown in Atlas catalog
 * experiences.
 *
 * Disabled assets remain hidden.
 * Coming-soon assets may still be displayed with appropriate
 * presentation messaging.
 */
export function isAtlasAssetVisible(
  asset: AtlasAssetDefinition
): boolean {
  return asset.status !== "DISABLED";
}

/**
 * Determines whether an asset may currently receive a client
 * allocation percentage.
 *
 * Atlas multi-asset launch:
 * Every registered asset except DISABLED assets may be configured.
 *
 * This is catalog eligibility only. It does not imply that the
 * connected account, broker, or execution platform supports the
 * asset. Planning and execution layers remain responsible for
 * enforcing broker and execution eligibility.
 */
export function isAtlasAssetAllocatable(
  asset: AtlasAssetDefinition
): boolean {
  return asset.status !== "DISABLED";
}

/**
 * Returns all assets eligible for display while preserving the
 * explicit ordering defined by the registry.
 */
export function getVisibleAtlasAssets(
  assetRegistry: readonly AtlasAssetDefinition[]
): readonly AtlasAssetDefinition[] {
  return assetRegistry.filter(isAtlasAssetVisible);
}

/**
 * Returns all assets eligible for client allocation while
 * preserving the explicit ordering defined by the registry.
 */
export function getAllocatableAtlasAssets(
  assetRegistry: readonly AtlasAssetDefinition[]
): readonly AtlasAssetDefinition[] {
  return assetRegistry.filter(isAtlasAssetAllocatable);
}