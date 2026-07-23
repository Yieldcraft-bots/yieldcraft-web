export interface CoinbaseMarketOrderPayload {
  client_order_id: string;
  product_id: string;
  side: "BUY";
  order_configuration: {
    market_market_ioc: {
      quote_size: string;
    };
  };
}

function money(n: number) {
  return Number(n.toFixed(2));
}

export function buildCoinbaseMarketBuyOrder(
  userId: string,
  productId: string,
  quoteSizeUsd: number,
  live: boolean
): CoinbaseMarketOrderPayload {
  const mode =
    live && process.env.ATLAS_LIVE_ARMED === "true"
      ? "live"
      : "dry_run";

  return {
    client_order_id: `yc_atlas_${mode}_${userId.slice(0, 8)}_${Date.now()}`,
    product_id: productId,
    side: "BUY",
    order_configuration: {
      market_market_ioc: {
        quote_size: money(quoteSizeUsd).toFixed(2),
      },
    },
  };
}

export function extractCoinbaseOrderId(parsed: any): string | null {
  const id =
    parsed?.success_response?.order_id ??
    parsed?.order_id ??
    parsed?.order?.order_id ??
    null;

  return typeof id === "string" && id.trim()
    ? id.trim()
    : null;
}