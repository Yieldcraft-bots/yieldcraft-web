type RangeBounceResult = {
  range_high: number;
  range_low: number;
  range_width_bps: number;
  price_position_pct: number;
  near_lower_band: boolean;
  near_upper_band: boolean;
  mid_band: number;
  signal: "BUY_LOWER_BAND" | "SELL_UPPER_BAND" | "NONE";
  note: string;
};

export function runRangeBounceTest(prices: number[]): RangeBounceResult | null {
  if (!prices.length || prices.length < 30) return null;

  const lookback = prices.slice(-30);
  const rangeHigh = Math.max(...lookback);
  const rangeLow = Math.min(...lookback);
  const lastPrice = lookback[lookback.length - 1];

  if (!Number.isFinite(rangeHigh) || !Number.isFinite(rangeLow) || !Number.isFinite(lastPrice)) {
    return null;
  }

  if (rangeHigh <= 0 || rangeLow <= 0 || rangeHigh <= rangeLow) {
    return null;
  }

  const midBand = (rangeHigh + rangeLow) / 2;
  const rangeWidthBps = ((rangeHigh - rangeLow) / midBand) * 10000;
  const pricePositionPct = ((lastPrice - rangeLow) / (rangeHigh - rangeLow)) * 100;

  const nearLowerBand = pricePositionPct <= 20;
  const nearUpperBand = pricePositionPct >= 80;

  let signal: "BUY_LOWER_BAND" | "SELL_UPPER_BAND" | "NONE" = "NONE";
  let note = "Price is inside the range but not near an actionable boundary.";

  if (nearLowerBand) {
    signal = "BUY_LOWER_BAND";
    note = "Price is near the lower 20% of the recent range.";
  } else if (nearUpperBand) {
    signal = "SELL_UPPER_BAND";
    note = "Price is near the upper 20% of the recent range.";
  }

  return {
    range_high: Number(rangeHigh.toFixed(2)),
    range_low: Number(rangeLow.toFixed(2)),
    range_width_bps: Number(rangeWidthBps.toFixed(2)),
    price_position_pct: Number(pricePositionPct.toFixed(2)),
    near_lower_band: nearLowerBand,
    near_upper_band: nearUpperBand,
    mid_band: Number(midBand.toFixed(2)),
    signal,
    note,
  };
}