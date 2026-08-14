/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Client
 *
 * PURPOSE
 * Isolated Coinbase communication boundary for Atlas live flow.
 *
 * SAFETY
 * - No approval logic
 * - No authorization logic
 * - No allocation logic
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No trading decisions
 *
 * This file only communicates with Coinbase.
 * ============================================================
 */

export interface AtlasCoinbaseRequestResult {
  success: boolean;
  status: number;
  response: unknown;
}


export type AtlasCoinbaseRequestContext = {
  apiKey: string;
  jwt: string;
};


export async function atlasCoinbasePost(
  context: AtlasCoinbaseRequestContext,
  path: string,
  payload: unknown
): Promise<AtlasCoinbaseRequestResult> {

  const response =
    await fetch(
      `https://api.coinbase.com${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${context.jwt}`,
        },
        body: JSON.stringify(payload),
      }
    );


  const data =
    await response
      .json()
      .catch(() => null);


  return {
    success: response.ok,
    status: response.status,
    response: data,
  };
}