/**
 * ============================================================
 * Atlas Intelligence
 * Asset Registry
 * ------------------------------------------------------------
 * PURPOSE
 * Central registry of every asset Atlas Intelligence understands.
 *
 * IMPORTANT
 * This file does NOT determine allocations.
 * This file does NOT execute trades.
 * This file does NOT communicate with Coinbase.
 * This file is simply the master list of supported assets.
 *
 * Execution engines may later reference this registry through
 * approved policy layers.
 * ============================================================
 */

import { AtlasAssetDefinition } from "./types";

export const ATLAS_ASSET_REGISTRY: readonly AtlasAssetDefinition[] = [
  // ------------------------------------------------------------------
  // Crypto
  // ------------------------------------------------------------------

  {
    symbol: "BTC",
    displayName: "Bitcoin",
    assetClass: "CRYPTO",
    enabled: true,
    status: "ACTIVE",
  },

  {
    symbol: "ETH",
    displayName: "Ethereum",
    assetClass: "CRYPTO",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "SOL",
    displayName: "Solana",
    assetClass: "CRYPTO",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "XRP",
    displayName: "XRP",
    assetClass: "CRYPTO",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "XLM",
    displayName: "Stellar",
    assetClass: "CRYPTO",
    enabled: false,
    status: "COMING_SOON",
  },

  // ------------------------------------------------------------------
  // Private Markets
  // ------------------------------------------------------------------

  {
    symbol: "SPACEX",
    displayName: "SpaceX",
    assetClass: "PRIVATE",
    enabled: false,
    status: "COMING_SOON",
  },

  // ------------------------------------------------------------------
  // MAG 7
  // ------------------------------------------------------------------

  {
    symbol: "AAPL",
    displayName: "Apple",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "MSFT",
    displayName: "Microsoft",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "NVDA",
    displayName: "NVIDIA",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "AMZN",
    displayName: "Amazon",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "META",
    displayName: "Meta",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "GOOGL",
    displayName: "Alphabet",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    symbol: "TSLA",
    displayName: "Tesla",
    assetClass: "STOCK",
    enabled: false,
    status: "COMING_SOON",
  },
] as const;