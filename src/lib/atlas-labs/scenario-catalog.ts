/**
 * ============================================================
 * Atlas Labs
 * Scenario Catalog
 * ------------------------------------------------------------
 * PURPOSE
 * Define deterministic, read-only scenarios for validating the
 * Atlas Intelligence Pipeline.
 *
 * This file only declares scenario data.
 * It does NOT run, validate, persist, or execute anything.
 *
 * SAFETY
 * - Read-only
 * - No Pulse
 * - No Atlas execution
 * - No Coinbase
 * - No Recon
 * - No Database
 * - No API
 * - No Orders
 * - No Trading
 * ============================================================
 */

import type { AtlasIntelligencePipelineInput } from
  "../atlas-intelligence/atlas-intelligence-pipeline";

export type AtlasScenarioCategory =
  | "SINGLE_ASSET"
  | "BASKET"
  | "MULTI_ASSET"
  | "PORTFOLIO_STATE"
  | "EDGE_CASE";

export interface AtlasScenario {
  id: string;
  name: string;
  description: string;
  category: AtlasScenarioCategory;
  enabled: boolean;
  input: AtlasIntelligencePipelineInput;
}

/**
 * Default controls used only by Atlas Labs scenarios.
 *
 * These values do not alter production Atlas policy and are
 * passed directly into the read-only intelligence pipeline.
 */
const DEFAULT_DEPLOY_PCT = 20;
const DEFAULT_MIN_BUY = 10;
const DEFAULT_MAX_BUY = 250;

export const ATLAS_SCENARIOS = [
  {
    id: "btc-only",
    name: "BTC Only",
    description:
      "Validates a client selection containing only Bitcoin.",
    category: "SINGLE_ASSET",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "eth-only",
    name: "ETH Only",
    description:
      "Validates a client selection containing only Ethereum.",
    category: "SINGLE_ASSET",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["ETH"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "spacex-only",
    name: "SpaceX Only",
    description:
      "Validates a client selection containing only SpaceX.",
    category: "SINGLE_ASSET",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["SPACEX"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "mag7-only",
    name: "MAG7 Only",
    description:
      "Validates expansion and analysis of the MAG7 basket.",
    category: "BASKET",
    enabled: true,
    input: {
      clientSelection: {
        baskets: ["MAG7"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "btc-spacex",
    name: "BTC + SpaceX",
    description:
      "Validates a mixed crypto and private-asset selection.",
    category: "MULTI_ASSET",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC", "SPACEX"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "mixed-portfolio",
    name: "Mixed Portfolio",
    description:
      "Validates existing holdings against crypto, SpaceX, and MAG7 targets.",
    category: "MULTI_ASSET",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC", "SPACEX"],
        baskets: ["MAG7"],
      },
      currentHoldings: ["BTC", "AAPL", "MSFT"],
      availableCash: 500,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "portfolio-complete",
    name: "Portfolio Complete",
    description:
      "Validates behavior when every selected asset is already owned.",
    category: "PORTFOLIO_STATE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC", "ETH"],
      },
      currentHoldings: ["BTC", "ETH"],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "no-cash",
    name: "No Cash Available",
    description:
      "Validates behavior when an asset is missing but no cash is available.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC"],
      },
      currentHoldings: [],
      availableCash: 0,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "below-minimum-buy",
    name: "Below Minimum Buy",
    description:
      "Validates behavior when the calculated deployment is below the minimum buy.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC"],
      },
      currentHoldings: [],
      availableCash: 25,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "duplicate-holdings",
    name: "Duplicate Holdings",
    description:
      "Validates deterministic handling of duplicate symbols in current holdings.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC", "ETH"],
      },
      currentHoldings: ["BTC", "BTC"],
      availableCash: 500,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "duplicate-selection",
    name: "Duplicate Selection",
    description:
      "Validates deduplication when an asset is selected directly and through a basket.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC", "ETH"],
        baskets: ["CRYPTO_LEADERS"],
      },
      currentHoldings: [],
      availableCash: 500,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "empty-selection",
    name: "Empty Selection",
    description:
      "Validates behavior when the client has selected no assets or baskets.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {},
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "negative-deploy-policy",
    name: "Negative Deploy Policy",
    description:
      "Validates safe rejection when the deployment percentage is negative.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: -20,
      minBuy: DEFAULT_MIN_BUY,
      maxBuy: DEFAULT_MAX_BUY,
    },
  },

  {
    id: "maximum-below-minimum",
    name: "Maximum Below Minimum",
    description:
      "Validates safe rejection when the maximum buy is below the minimum buy.",
    category: "EDGE_CASE",
    enabled: true,
    input: {
      clientSelection: {
        assets: ["BTC"],
      },
      currentHoldings: [],
      availableCash: 1_000,
      deployPct: DEFAULT_DEPLOY_PCT,
      minBuy: 50,
      maxBuy: 25,
    },
  },
] satisfies readonly AtlasScenario[];

export function getEnabledAtlasScenarios(): readonly AtlasScenario[] {
  return ATLAS_SCENARIOS.filter((scenario) => scenario.enabled);
}

export function getAtlasScenarioById(
  scenarioId: string
): AtlasScenario | null {
  return (
    ATLAS_SCENARIOS.find(
      (scenario) => scenario.id === scenarioId
    ) ?? null
  );
}