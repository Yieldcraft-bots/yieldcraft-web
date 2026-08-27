/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Market Observation V1
 * ------------------------------------------------------------
 * PURPOSE
 * Read current Coinbase market data for one Atlas asset and
 * convert those observations into the normalized market inputs
 * required by Multi-Asset Entry Intelligence.
 *
 * DATA SOURCES
 * - CRYPTO:
 *   Public Coinbase five-minute candles.
 *
 * - STOCK:
 *   Authenticated Coinbase EQUITY product snapshot using the
 *   canonical Coinbase product ID.
 *
 * IMPORTANT
 * Coinbase candle endpoints are not used for equities.
 *
 * SAFETY
 * - Atlas Multi-Asset only
 * - Read-only market data
 * - No order submission
 * - No approval mutation
 * - No authorization mutation
 * - No Supabase
 * - No legacy Atlas
 * - No Pulse
 * - No Recon
 * - No execution imports
 *
 * Any market-data failure returns an unavailable observation.
 * Unavailable observations can NEVER become permission to buy.
 * ============================================================
 */

import type {
  AtlasMarketRegime,
  AtlasMultiAssetMarketSnapshot,
} from "./entry-intelligence";

import {
  getAtlasAsset,
} from "../atlas-assets";

import {
  evaluateAtlasEquityTradability,
} from "../atlas-equity-tradability-gate";


type CoinbaseCandle = {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
};


type CoinbaseCandlesResponse = {
  candles?: CoinbaseCandle[];
};


export interface AtlasMultiAssetMarketObservation {
  symbol: string;

  productId: string;

  observedAt: string;

  candleCount: number;

  latestPrice: number;

  snapshot:
    AtlasMultiAssetMarketSnapshot;
}


const COINBASE_MARKET_BASE =
  "https://api.coinbase.com/api/v3/brokerage/market";


function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {

  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}


function average(
  values: readonly number[]
): number {

  if (
    values.length ===
      0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    values.length
  );
}


function standardDeviation(
  values: readonly number[]
): number {

  if (
    values.length <
      2
  ) {
    return 0;
  }

  const mean =
    average(
      values
    );

  const variance =
    average(
      values.map(
        (
          value
        ) =>
          (
            value -
            mean
          ) **
          2
      )
    );

  return Math.sqrt(
    variance
  );
}


function percentChange(
  from:
    number,
  to:
    number
): number {

  if (
    !Number.isFinite(
      from
    ) ||
    !Number.isFinite(
      to
    ) ||
    from <=
      0
  ) {
    return 0;
  }

  return (
    to -
    from
  ) /
  from;
}


function normalizeSigned(
  value: number,
  scale: number
): number {

  if (
    !Number.isFinite(
      value
    ) ||
    scale <=
      0
  ) {
    return 0;
  }

  return clamp(
    value /
      scale,
    -1,
    1
  );
}


function normalizeUnit(
  value: number
): number {

  return clamp(
    value,
    0,
    1
  );
}


/**
 * Crypto regime based on candle-derived short/long averages.
 */
function determineCryptoRegime(
  shortAverage:
    number,
  longAverage:
    number,
  momentum:
    number
): AtlasMarketRegime {

  if (
    longAverage <=
      0
  ) {
    return "NEUTRAL";
  }


  const trendDifference =
    (
      shortAverage -
      longAverage
    ) /
    longAverage;


  if (
    trendDifference >=
      0.015 &&
    momentum >
      0
  ) {
    return "STRONG_BULL";
  }


  if (
    trendDifference >=
      0.003
  ) {
    return "BULL";
  }


  if (
    trendDifference <=
      -0.015 &&
    momentum <
      0
  ) {
    return "STRONG_BEAR";
  }


  if (
    trendDifference <=
      -0.003
  ) {
    return "BEAR";
  }


  return "NEUTRAL";
}


function unavailableObservation(
  symbol:
    string,
  productId:
    string
): AtlasMultiAssetMarketObservation {

  return {
    symbol:
      symbol
        .trim()
        .toUpperCase(),

    productId,

    observedAt:
      new Date()
        .toISOString(),

    candleCount:
      0,

    latestPrice:
      0,

    snapshot: {
      regime:
        "NEUTRAL",

      trendScore:
        0,

      momentumScore:
        0,

      pullbackQuality:
        0,

      volatilityScore:
        0,

      relativeStrengthScore:
        0,

      marketOpen:
        false,

      dataFresh:
        false,
    },
  };
}


/**
 * ============================================================
 * CRYPTO MARKET DATA
 * ============================================================
 */

async function loadCoinbaseCandles(
  productId:
    string
): Promise<CoinbaseCandle[]> {

  const nowSeconds =
    Math.floor(
      Date.now() /
        1000
    );


  /*
   * Five-minute candles covering roughly the previous
   * five hours.
   */
  const startSeconds =
    nowSeconds -
    (
      5 *
      60 *
      60
    );


  const url =
    new URL(
      `${COINBASE_MARKET_BASE}/products/${encodeURIComponent(
        productId
      )}/candles`
    );


  url.searchParams.set(
    "start",
    String(
      startSeconds
    )
  );

  url.searchParams.set(
    "end",
    String(
      nowSeconds
    )
  );

  url.searchParams.set(
    "granularity",
    "FIVE_MINUTE"
  );

  url.searchParams.set(
    "limit",
    "60"
  );


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  if (
    !response.ok
  ) {
    throw new Error(
      `atlas_multi_asset_market_data_http_${response.status}`
    );
  }


  const payload =
    await response.json() as
      CoinbaseCandlesResponse;


  if (
    !Array.isArray(
      payload.candles
    )
  ) {
    throw new Error(
      "atlas_multi_asset_market_candles_missing"
    );
  }


  return payload.candles;
}


async function observeCryptoMarket(
  symbol:
    string,
  productId:
    string
): Promise<AtlasMultiAssetMarketObservation> {

  let rawCandles:
    CoinbaseCandle[];


  try {

    rawCandles =
      await loadCoinbaseCandles(
        productId
      );

  } catch {

    /*
     * Market-data failure must NEVER become permission to buy.
     */
    return unavailableObservation(
      symbol,
      productId
    );
  }


  /*
   * Coinbase may return newest-first.
   * Normalize into chronological order.
   */
  const candles =
    rawCandles
      .map(
        (
          candle
        ) => ({
          start:
            Number(
              candle.start
            ),

          open:
            Number(
              candle.open
            ),

          high:
            Number(
              candle.high
            ),

          low:
            Number(
              candle.low
            ),

          close:
            Number(
              candle.close
            ),

          volume:
            Number(
              candle.volume
            ),
        })
      )
      .filter(
        (
          candle
        ) =>
          Number.isFinite(
            candle.start
          ) &&
          Number.isFinite(
            candle.open
          ) &&
          Number.isFinite(
            candle.high
          ) &&
          Number.isFinite(
            candle.low
          ) &&
          Number.isFinite(
            candle.close
          ) &&
          candle.close >
            0
      )
      .sort(
        (
          left,
          right
        ) =>
          left.start -
          right.start
      );


  if (
    candles.length <
      20
  ) {
    return unavailableObservation(
      symbol,
      productId
    );
  }


  const closes =
    candles.map(
      (
        candle
      ) =>
        candle.close
    );


  const latestCandle =
    candles[
      candles.length -
        1
    ];


  const latestPrice =
    latestCandle.close;


  const shortWindow =
    closes.slice(
      -6
    );


  const longWindow =
    closes.slice(
      -20
    );


  const shortAverage =
    average(
      shortWindow
    );


  const longAverage =
    average(
      longWindow
    );


  const trendDifference =
    longAverage >
      0
      ? (
          shortAverage -
          longAverage
        ) /
        longAverage
      : 0;


  const trendScore =
    normalizeSigned(
      trendDifference,
      0.02
    );


  const momentumReferenceIndex =
    Math.max(
      0,
      closes.length -
        7
    );


  const momentum =
    percentChange(
      closes[
        momentumReferenceIndex
      ],
      latestPrice
    );


  const momentumScore =
    normalizeSigned(
      momentum,
      0.03
    );


  const recentHigh =
    Math.max(
      ...candles
        .slice(
          -20
        )
        .map(
          (
            candle
          ) =>
            candle.high
        )
    );


  const pullbackPercent =
    recentHigh >
      0
      ? (
          recentHigh -
          latestPrice
        ) /
        recentHigh
      : 0;


  const pullbackQuality =
    normalizeUnit(
      pullbackPercent /
        0.05
    );


  const returns:
    number[] =
      [];


  for (
    let index =
      1;
    index <
      closes.length;
    index +=
      1
  ) {

    returns.push(
      percentChange(
        closes[
          index -
            1
        ],
        closes[
          index
        ]
      )
    );
  }


  const realizedVolatility =
    standardDeviation(
      returns.slice(
        -20
      )
    );


  const volatilityScore =
    normalizeUnit(
      realizedVolatility /
        0.02
    );


  const shortReturn =
    percentChange(
      closes[
        Math.max(
          0,
          closes.length -
            7
        )
      ],
      latestPrice
    );


  const longReturn =
    percentChange(
      closes[
        Math.max(
          0,
          closes.length -
            20
        )
      ],
      latestPrice
    );


  const relativeStrengthScore =
    normalizeSigned(
      shortReturn -
        longReturn,
      0.03
    );


  const regime =
    determineCryptoRegime(
      shortAverage,
      longAverage,
      momentum
    );


  const latestCandleAgeSeconds =
    Math.max(
      0,
      Math.floor(
        Date.now() /
          1000
      ) -
        latestCandle.start
    );


  const dataFresh =
    latestCandleAgeSeconds <=
      (
        15 *
        60
      );


  const marketOpen =
    dataFresh;


  return {
    symbol,

    productId,

    observedAt:
      new Date()
        .toISOString(),

    candleCount:
      candles.length,

    latestPrice,

    snapshot: {
      regime,

      trendScore,

      momentumScore,

      pullbackQuality,

      volatilityScore,

      relativeStrengthScore,

      marketOpen,

      dataFresh,
    },
  };
}


/**
 * ============================================================
 * EQUITY MARKET DATA
 * ============================================================
 *
 * Coinbase does not expose the crypto candle endpoint for
 * equities.
 *
 * Coinbase DOES expose authoritative execution readiness:
 *
 * - product_type = EQUITY
 * - trading enabled
 * - not view-only
 * - tradable
 * - BUY enabled
 * - not halted
 * - NORMAL trading session
 *
 * Coinbase currently does NOT expose reliable live equity
 * price/bid/ask/candle data through the API paths available
 * to Atlas.
 *
 * Therefore equities use an explicit Coinbase-only
 * execution-readiness mode.
 *
 * We DO NOT invent historical or current market signals.
 * ============================================================
 */

async function observeEquityMarket(
  userId:
    string,
  symbol:
    string,
  productId:
    string
): Promise<AtlasMultiAssetMarketObservation> {

  let equity;


  try {

    equity =
      await evaluateAtlasEquityTradability(
        userId,
        productId
      );

  } catch {

    return unavailableObservation(
      symbol,
      productId
    );
  }


  /*
   * Coinbase tradability/session state is authoritative.
   *
   * If Coinbase does not affirmatively prove normal-session
   * tradability, intelligence must WAIT.
   */
  if (
    !equity.allowed
  ) {
    return unavailableObservation(
      symbol,
      productId
    );
  }


  /*
   * Coinbase has proved execution readiness, but has not
   * supplied trustworthy live price-derived market data.
   *
   * Do not manufacture any market signals.
   *
   * Entry Intelligence recognizes executionReadinessOnly=true
   * and permits only a minimum-size staged accumulation.
   *
   * The live Coinbase execution adapter performs its own
   * independent tradability/session check again immediately
   * before submitting any real order.
   */
  return {
    symbol,

    productId,

    observedAt:
      new Date()
        .toISOString(),

    candleCount:
      0,

    latestPrice:
      0,

    snapshot: {
      regime:
        "NEUTRAL",

      trendScore:
        0,

      momentumScore:
        0,

      pullbackQuality:
        0,

      volatilityScore:
        0,

      relativeStrengthScore:
        0,

      marketOpen:
        true,

      dataFresh:
        true,

      executionReadinessOnly:
        true,
    },
  };
}


/**
 * ============================================================
 * PUBLIC OBSERVATION ENTRY
 * ============================================================
 */

export async function observeAtlasMultiAssetMarket(
  input: {
    userId:
      string;

    symbol:
      string;

    productId:
      string;
  }
): Promise<AtlasMultiAssetMarketObservation> {

  const userId =
    input.userId
      .trim();


  const symbol =
    input.symbol
      .trim()
      .toUpperCase();


  const productId =
    input.productId
      .trim();


  if (
    !userId ||
    !symbol ||
    !productId
  ) {
    return unavailableObservation(
      symbol,
      productId
    );
  }


  const asset =
    getAtlasAsset(
      symbol
    );


  if (!asset) {
    return unavailableObservation(
      symbol,
      productId
    );
  }


  if (
    asset.assetClass ===
      "stock"
  ) {
    return observeEquityMarket(
      userId,
      symbol,
      productId
    );
  }


  return observeCryptoMarket(
    symbol,
    productId
  );
}