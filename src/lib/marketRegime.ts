export function detectMarketRegime(volBps: number) {
  if (volBps < 8) {
    return "LOW_LIQUIDITY";
  }

  if (volBps >= 8 && volBps < 20) {
    return "RANGING";
  }

  if (volBps >= 20 && volBps < 40) {
    return "TRENDING";
  }

  return "VOLATILE";
}