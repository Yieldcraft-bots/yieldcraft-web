/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Market Observation V1
 * ------------------------------------------------------------
 * PURPOSE
 * Read current Coinbase market candles for one Atlas asset and
 * convert those observations into the normalized market inputs
 * required by Multi-Asset Entry Intelligence.
 *
 * V1 MEASURES
 * - directional trend
 * - short-term momentum
 * - pullback / entry quality
 * - realized volatility
 * - relative strength versus recent history
 * - broad market regime
 * - market-data freshness
 *
 * IMPORTANT
 * This module observes markets only.
 *
 * It NEVER:
 * - submits an order
 * - accesses client credentials
 * - accesses Supabase
 * - changes allocations
 * - changes pending balances
 * - approves or authorizes anything
 * - creates SELL instructions
 *
 * SAFETY
 * - Atlas Multi-Asset only
 * - Read-only public market data
 * - No legacy Atlas
 * - No Pulse
 * - No Recon
 * - No execution imports
 * - No database
 * ============================================================
 */

import type {
  AtlasMarketRegime,
  AtlasMultiAssetMarketSnapshot,
} from "./entry-intelligence";


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


function determineRegime(
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
   *
   * This is intentionally short-horizon V1 entry intelligence,
   * not long-term asset-selection logic. The client already
   * selected the asset through their allocation mandate.
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


export async function observeAtlasMultiAssetMarket(
  input: {
    symbol:
      string;

    productId:
      string;
  }
): Promise<AtlasMultiAssetMarketObservation> {

  const symbol =
    input.symbol
      .trim()
      .toUpperCase();


  const productId =
    input.productId
      .trim();


  if (
    !symbol ||
    !productId
  ) {
    return unavailableObservation(
      symbol,
      productId
    );
  }


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
     *
     * Return stale/unavailable observation so intelligence
     * chooses WAIT rather than inventing market conditions.
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


  /*
   * We want enough observations for both a short and longer
   * moving window. Insufficient history fails closed.
   */
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


  /*
   * ==========================================================
   * TREND
   * ==========================================================
   */

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


  /*
   * +/- 2% short-vs-long separation maps to the ends of the
   * normalized trend scale.
   */
  const trendScore =
    normalizeSigned(
      trendDifference,
      0.02
    );


  /*
   * ==========================================================
   * MOMENTUM
   * ==========================================================
   */

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


  /*
   * +/- 3% over the recent observation window maps to +/-1.
   */
  const momentumScore =
    normalizeSigned(
      momentum,
      0.03
    );


  /*
   * ==========================================================
   * PULLBACK QUALITY
   * ==========================================================
   *
   * For an accumulation product, a controlled discount from a
   * recent high can be preferable to chasing an extended move.
   *
   * A 0% pullback receives little benefit.
   * Roughly 1-5% pullbacks progressively improve the score.
   * Extremely deep moves do not receive unlimited benefit.
   */

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


  /*
   * ==========================================================
   * REALIZED VOLATILITY
   * ==========================================================
   */

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


  /*
   * 2% standard deviation per five-minute return is treated as
   * the upper end of V1's volatility scale.
   */
  const volatilityScore =
    normalizeUnit(
      realizedVolatility /
        0.02
    );


  /*
   * ==========================================================
   * RELATIVE STRENGTH V1
   * ==========================================================
   *
   * V1 compares recent performance with the asset's longer
   * observation window.
   *
   * This deliberately avoids coupling the launch version to a
   * second benchmark-data dependency. A future version can
   * replace this component with cross-asset/benchmark strength
   * without changing the intelligence or execution contracts.
   */

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


  /*
   * ==========================================================
   * REGIME
   * ==========================================================
   */

  const regime =
    determineRegime(
      shortAverage,
      longAverage,
      momentum
    );


  /*
   * ==========================================================
   * FRESHNESS
   * ==========================================================
   *
   * Five-minute observations are considered usable when the
   * newest candle is no more than 15 minutes old.
   */

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


  /*
   * For the Coinbase execution universe, V1 treats a product
   * with fresh actively-returning Coinbase candles as presently
   * observable/executable from the intelligence perspective.
   *
   * Downstream execution eligibility remains authoritative.
   */
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