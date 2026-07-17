/**
 * Atlas Labs
 * Scenario Catalog
 *
 * Single responsibility:
 * Defines the catalog of validation scenarios available to Atlas Labs.
 *
 * This file contains no business logic, execution logic,
 * recommendation logic, or validation logic.
 */

export interface AtlasScenario {
  id: string;
  name: string;
  description: string;

  enabled: boolean;

  availableCashUsd: number;

  selectedAssets: string[];

  selectedBaskets: string[];

  currentHoldings: Record<string, number>;
}

export const ATLAS_SCENARIOS: AtlasScenario[] = [
  {
    id: "btc-only",
    name: "BTC Only",
    description: "Client wants to accumulate only Bitcoin.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: ["BTC"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "eth-only",
    name: "ETH Only",
    description: "Client wants to accumulate only Ethereum.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: ["ETH"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "spacex-only",
    name: "SpaceX Only",
    description: "Client wants to accumulate only SpaceX.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: ["SPACEX"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "mag7-only",
    name: "MAG7 Only",
    description: "Client targets the MAG7 basket.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: [],
    selectedBaskets: ["MAG7"],
    currentHoldings: {},
  },

  {
    id: "btc-spacex",
    name: "BTC + SpaceX",
    description: "Client accumulates BTC and SpaceX together.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: ["BTC", "SPACEX"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "mixed-portfolio",
    name: "Mixed Portfolio",
    description: "Existing diversified holdings.",
    enabled: true,
    availableCashUsd: 500,
    selectedAssets: ["BTC", "ETH"],
    selectedBaskets: ["MAG7"],
    currentHoldings: {
      BTC: 2500,
      ETH: 1500,
      SPACEX: 3000,
    },
  },

  {
    id: "portfolio-complete",
    name: "Portfolio Complete",
    description: "Portfolio already matches target allocation.",
    enabled: true,
    availableCashUsd: 0,
    selectedAssets: ["BTC"],
    selectedBaskets: [],
    currentHoldings: {
      BTC: 10000,
    },
  },

  {
    id: "no-cash",
    name: "No Cash Available",
    description: "No available cash for allocation.",
    enabled: true,
    availableCashUsd: 0,
    selectedAssets: ["BTC"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "unsupported-asset",
    name: "Unsupported Asset",
    description: "Tests unsupported asset handling.",
    enabled: true,
    availableCashUsd: 1000,
    selectedAssets: ["UNKNOWN"],
    selectedBaskets: [],
    currentHoldings: {},
  },

  {
    id: "duplicate-holdings",
    name: "Duplicate Holdings",
    description: "Duplicate holdings edge case.",
    enabled: true,
    availableCashUsd: 500,
    selectedAssets: ["BTC"],
    selectedBaskets: [],
    currentHoldings: {
      BTC: 1000,
    },
  },
];