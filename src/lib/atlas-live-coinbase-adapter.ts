/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase Adapter
 *
 * PURPOSE
 * Controlled Coinbase boundary for Atlas live execution.
 *
 * SAFETY
 * - Receives only approved execution instructions
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 * - No order decisions
 *
 * This adapter owns Coinbase communication only.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";


export interface AtlasLiveCoinbaseAdapterResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


export async function submitAtlasLiveCoinbaseOrder(
  instruction: AtlasExecutionInstruction
): Promise<AtlasLiveCoinbaseAdapterResult> {

  return {
    success: false,
    submitted: false,
    response: {
      mode: "live",
      reason: "coinbase_live_adapter_not_connected",
      instruction,
    },
  };
}