/**
 * Basket Registry
 *
 * Single responsibility:
 * Define reusable collections of supported assets.
 *
 * This file knows NOTHING about:
 * - Coinbase
 * - Pulse
 * - Atlas execution
 * - Recon
 * - Orders
 * - Users
 * - Allocations
 * - Portfolio logic
 */

import { SupportedAsset } from "./types";

export type SupportedBasket =
  | "MAG7"
  | "CRYPTO_LEADERS"
  | "SPACE"
  | "CUSTOM";

export const BasketRegistry: Record<
  Exclude<SupportedBasket, "CUSTOM">,
  SupportedAsset[]
> = {
  MAG7: [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "GOOGL",
    "TSLA",
  ],

  CRYPTO_LEADERS: [
    "BTC",
    "ETH",
  ],

  SPACE: [
    "SPACEX",
  ],
};

export function getBasketAssets(
  basket: Exclude<SupportedBasket, "CUSTOM">
): SupportedAsset[] {
  return BasketRegistry[basket];
}