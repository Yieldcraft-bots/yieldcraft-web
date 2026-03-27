import { NextResponse } from "next/server";

function detectRegime(prices: number[]) {
  if (prices.length < 20) return "UNKNOWN";

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const avg =
    returns.reduce((a, b) => a + b, 0) / returns.length;

  const variance =
    returns.reduce((a, b) => a + Math.pow(b - avg, 2), 0) /
    returns.length;

  const volatility = Math.sqrt(variance) * 10000; // bps

  if (volatility < 20) return "RANGING";
  if (volatility < 60) return "NORMAL";
  return "VOLATILE";
}

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coinbase.com/api/v3/brokerage/products/BTC-USD/candles?granularity=ONE_MINUTE&limit=100",
      { cache: "no-store" }
    );

    const data = await res.json();

    if (!data.candles) {
      return NextResponse.json({
        ok: false,
        error: "no_data",
      });
    }

    const prices = data.candles.map((c: any) =>
      parseFloat(c.close)
    );

    const regime = detectRegime(prices);

    let status = "neutral";
    let note = "";

    if (regime === "RANGING") {
      status = "avoid";
      note = "Low volatility + chop → poor edge environment";
    } else if (regime === "VOLATILE") {
      status = "favorable";
      note = "Expansion + movement → potential edge";
    } else {
      status = "neutral";
      note = "Moderate conditions → selective entries only";
    }

    return NextResponse.json({
      ok: true,
      status,
      regime,
      sample: prices.length,
      note,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
}