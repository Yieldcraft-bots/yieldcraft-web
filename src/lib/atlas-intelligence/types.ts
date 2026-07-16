/**
 * ============================================================
 * Atlas Intelligence
 * Shared Type Definitions
 * ------------------------------------------------------------
 * PURPOSE
 * Defines the shared contracts used by the Atlas Intelligence
 * layer. This file contains NO execution logic.
 *
 * SAFETY
 * - Read-only
 * - No trading logic
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Recon imports
 * - No Coinbase imports
 * ============================================================
 */

export type AssetClass =
  | "CRYPTO"
  | "STOCK"
  | "ETF"
  | "PRIVATE";

export type AssetStatus =
  | "ACTIVE"
  | "COMING_SOON"
  | "DISABLED";

export interface AtlasAssetDefinition {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  enabled: boolean;
  status: AssetStatus;
}