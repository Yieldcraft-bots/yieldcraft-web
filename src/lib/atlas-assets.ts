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

  {
    id: "eth",
    symbol: "ETH",
    displayName: "Ethereum",

    broker: "coinbase",

    usdPair: "ETH-USD",
    usdcPair: "ETH-USDC",

    accumulationEnabled: true,
  },

  {
    id: "sol",
    symbol: "SOL",
    displayName: "Solana",

    broker: "coinbase",

    usdPair: "SOL-USD",
    usdcPair: "SOL-USDC",

    accumulationEnabled: true,
  },

  {
    id: "xrp",
    symbol: "XRP",
    displayName: "XRP",

    broker: "coinbase",

    usdPair: "XRP-USD",
    usdcPair: "XRP-USDC",

    accumulationEnabled: true,
  },

  {
    id: "xlm",
    symbol: "XLM",
    displayName: "Stellar",

    broker: "coinbase",

    usdPair: "XLM-USD",
    usdcPair: "XLM-USDC",

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