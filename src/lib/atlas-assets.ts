/**
 * Atlas Asset Registry
 *
 * Single responsibility:
 * Define the assets Atlas understands.
 *
 * This file knows NOTHING about:
 * - execution
 * - Coinbase
 * - Interactive Brokers
 * - users
 * - allocations
 * - orders
 * - APIs
 */

export type AtlasBroker = "coinbase";

export type AtlasAsset = {
  id: string;
  symbol: string;
  displayName: string;

  broker: AtlasBroker;

  usdPair?: string;
  usdcPair?: string;

  accumulationEnabled: boolean;
};

export const ATLAS_ASSETS: readonly AtlasAsset[] = [
  {
    id: "btc",
    symbol: "BTC",
    displayName: "Bitcoin",

    broker: "coinbase",

    usdPair: "BTC-USD",
    usdcPair: "BTC-USDC",

    accumulationEnabled: true,
  },
] as const;

export function getAtlasAsset(
  symbol: string
): AtlasAsset | undefined {
  return ATLAS_ASSETS.find(
    (asset) => asset.symbol === symbol.toUpperCase()
  );
}