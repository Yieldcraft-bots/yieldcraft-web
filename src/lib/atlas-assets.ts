/**
 * Atlas Asset Registry
 *
 * Single responsibility:
 * Define assets Atlas understands.
 *
 * This file knows NOTHING about:
 * - execution
 * - Coinbase
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

  // Crypto

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


  // Equities (registry entries)
  {
    id: "aapl",
    symbol: "AAPL",
    displayName: "Apple",
    broker: "coinbase",
    usdPair: "AAPL-USD",
    accumulationEnabled: true,
  },

  {
    id: "msft",
    symbol: "MSFT",
    displayName: "Microsoft",
    broker: "coinbase",
    usdPair: "MSFT-USD",
    accumulationEnabled: true,
  },

  {
    id: "nvda",
    symbol: "NVDA",
    displayName: "NVIDIA",
    broker: "coinbase",
    usdPair: "NVDA-USD",
    accumulationEnabled: true,
  },

  {
    id: "amzn",
    symbol: "AMZN",
    displayName: "Amazon",
    broker: "coinbase",
    usdPair: "AMZN-USD",
    accumulationEnabled: true,
  },

  {
    id: "meta",
    symbol: "META",
    displayName: "Meta",
    broker: "coinbase",
    usdPair: "META-USD",
    accumulationEnabled: true,
  },

  {
    id: "googl",
    symbol: "GOOGL",
    displayName: "Alphabet",
    broker: "coinbase",
    usdPair: "GOOGL-USD",
    accumulationEnabled: true,
  },

  {
    id: "tsla",
    symbol: "TSLA",
    displayName: "Tesla",
    broker: "coinbase",
    usdPair: "TSLA-USD",
    accumulationEnabled: true,
  },

  {
    id: "spacex",
    symbol: "SPACEX",
    displayName: "SpaceX",
    broker: "coinbase",
    usdPair: "SPACEX-USD",
    accumulationEnabled: true,
  },

] as const;


export function getAtlasAsset(
  symbol: string
): AtlasAsset | undefined {

  return ATLAS_ASSETS.find(
    (asset) =>
      asset.symbol === symbol.toUpperCase()
  );
}