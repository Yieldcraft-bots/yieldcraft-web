/**
 * ============================================================
 * Atlas Intelligence
 * Broker Registry
 * ------------------------------------------------------------
 * PURPOSE
 * Central registry of every broker Atlas Intelligence
 * understands.
 *
 * This file does NOT execute trades.
 * This file does NOT contain credentials.
 * This file does NOT contain broker capabilities.
 * This file simply defines the brokers known to Atlas.
 *
 * SAFETY
 * - Read-only
 * - No Pulse imports
 * - No Atlas execution imports
 * - No Coinbase imports
 * - No API clients
 * ============================================================
 */

export type AtlasBroker =
  | "COINBASE"
  | "IBKR"
  | "SCHWAB"
  | "FIDELITY"
  | "ROBINHOOD"
  | "FORGE";

export type AtlasBrokerStatus =
  | "ACTIVE"
  | "COMING_SOON"
  | "DISABLED";

export interface AtlasBrokerDefinition {
  broker: AtlasBroker;
  displayName: string;
  enabled: boolean;
  status: AtlasBrokerStatus;
}

export const ATLAS_BROKER_REGISTRY: readonly AtlasBrokerDefinition[] = [
  {
    broker: "COINBASE",
    displayName: "Coinbase",
    enabled: true,
    status: "ACTIVE",
  },

  {
    broker: "IBKR",
    displayName: "Interactive Brokers",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    broker: "SCHWAB",
    displayName: "Charles Schwab",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    broker: "FIDELITY",
    displayName: "Fidelity",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    broker: "ROBINHOOD",
    displayName: "Robinhood",
    enabled: false,
    status: "COMING_SOON",
  },

  {
    broker: "FORGE",
    displayName: "Forge Global",
    enabled: false,
    status: "COMING_SOON",
  },
] as const;