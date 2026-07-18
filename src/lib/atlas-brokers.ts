/**
 * Atlas Broker Registry
 *
 * Single responsibility:
 * Describe the capabilities of supported brokers.
 *
 * This file knows NOTHING about:
 * - Atlas execution
 * - Pulse
 * - Recon
 * - Orders
 * - Users
 * - Allocations
 * - APIs
 */

export type AtlasBrokerId =
  | "coinbase"
  | "interactive_brokers"
  | "kraken";

export type AtlasBroker = {
  id: AtlasBrokerId;
  displayName: string;

  supportsUsd: boolean;
  supportsUsdc: boolean;

  supportsCrypto: boolean;
  supportsStocks: boolean;

  enabled: boolean;
};

export const ATLAS_BROKERS: readonly AtlasBroker[] = [
  {
    id: "coinbase",
    displayName: "Coinbase",

    supportsUsd: true,
    supportsUsdc: true,

    supportsCrypto: true,
    supportsStocks: false,

    enabled: true,
  },

  {
    id: "interactive_brokers",
    displayName: "Interactive Brokers",

    supportsUsd: true,
    supportsUsdc: false,

    supportsCrypto: false,
    supportsStocks: true,

    enabled: false,
  },

  {
    id: "kraken",
    displayName: "Kraken",

    supportsUsd: true,
    supportsUsdc: true,

    supportsCrypto: true,
    supportsStocks: false,

    enabled: false,
  },
] as const;

export function getAtlasBroker(id: AtlasBrokerId) {
  return ATLAS_BROKERS.find((broker) => broker.id === id);
}