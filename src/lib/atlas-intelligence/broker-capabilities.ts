/**
 * ============================================================
 * Atlas Intelligence
 * Broker Capability Registry
 * ------------------------------------------------------------
 * PURPOSE
 * Describes what each broker is capable of.
 *
 * This file contains NO execution logic.
 *
 * SAFETY
 * - Read-only
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Coinbase SDK
 * - No API clients
 * - No credentials
 * ============================================================
 */

import { AtlasBroker } from "./broker-registry";
import { AssetClass } from "./types";

export interface AtlasBrokerCapability {
  broker: AtlasBroker;

  supportedAssetClasses: readonly AssetClass[];

  supportsFractional: boolean;

  supportsRecurring: boolean;

  supportsMarketOrders: boolean;

  supportsLimitOrders: boolean;

  supports24x7Trading: boolean;

  productionReady: boolean;
}

export const ATLAS_BROKER_CAPABILITIES: readonly AtlasBrokerCapability[] = [
  {
    broker: "COINBASE",

    supportedAssetClasses: ["CRYPTO"],

    supportsFractional: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,

    supports24x7Trading: true,

    productionReady: true,
  },

  {
    broker: "IBKR",

    supportedAssetClasses: ["STOCK", "ETF"],

    supportsFractional: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,

    supports24x7Trading: false,

    productionReady: false,
  },

  {
    broker: "SCHWAB",

    supportedAssetClasses: ["STOCK", "ETF"],

    supportsFractional: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,

    supports24x7Trading: false,

    productionReady: false,
  },

  {
    broker: "FIDELITY",

    supportedAssetClasses: ["STOCK", "ETF"],

    supportsFractional: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,

    supports24x7Trading: false,

    productionReady: false,
  },

  {
    broker: "ROBINHOOD",

    supportedAssetClasses: ["CRYPTO", "STOCK", "ETF"],

    supportsFractional: true,

    supportsRecurring: true,

    supportsMarketOrders: true,

    supportsLimitOrders: true,

    supports24x7Trading: true,

    productionReady: false,
  },

  {
    broker: "FORGE",

    supportedAssetClasses: ["PRIVATE"],

    supportsFractional: false,

    supportsRecurring: false,

    supportsMarketOrders: false,

    supportsLimitOrders: false,

    supports24x7Trading: false,

    productionReady: false,
  },
] as const;