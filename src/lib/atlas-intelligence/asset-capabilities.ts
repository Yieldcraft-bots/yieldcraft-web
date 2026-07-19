/**
 * ============================================================
 * Atlas Intelligence
 * Asset Capability Registry
 * ------------------------------------------------------------
 * PURPOSE
 * Describes what each supported asset is capable of.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read-only
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Coinbase imports
 * - No Recon imports
 * - No trading logic
 * ============================================================
 */

import { SupportedAsset } from "./types";

export interface AtlasAssetCapability {
  symbol: SupportedAsset;

  fractional: boolean;

  productionReady: boolean;

  shadowSupported: boolean;

  supportsRecurring: boolean;

  supportsMarketOrders: boolean;

  supportsLimitOrders: boolean;
}

export const ATLAS_ASSET_CAPABILITIES: readonly AtlasAssetCapability[] = [
  {
    symbol: "BTC",

    fractional: true,

    productionReady: true,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "ETH",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "SOL",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "XRP",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "XLM",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "SPACEX",

    fractional: false,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: false,

    supportsMarketOrders: false,

    supportsLimitOrders: false,
  },

  {
    symbol: "AAPL",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "MSFT",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "NVDA",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "AMZN",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "META",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "GOOGL",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },

  {
    symbol: "TSLA",

    fractional: true,

    productionReady: false,

    shadowSupported: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,
  },
] as const;