/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Gateway
 *
 * PURPOSE
 * Controlled boundary between authorized Atlas state
 * and future live execution.
 *
 * SAFETY
 * - Requires valid authorization
 * - Requires AUTHORIZED status
 * - Requires ATLAS_LIVE_ARMED=true
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 * - No order submission in this layer
 *
 * This file only decides whether live execution
 * is permitted.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-operations/atlas-execution-authorization-contract";

import {
  evaluateAtlasExecutionAuthorizationGate,
} from "./atlas-operations";


export type AtlasLiveExecutionGatewayResult = {
  allowed: boolean;
  reason: string;
  instruction?: AtlasExecutionInstruction;
};


export function evaluateAtlasLiveExecutionGateway(
  authorization: AtlasExecutionAuthorizationContract,
  instruction: AtlasExecutionInstruction
): AtlasLiveExecutionGatewayResult {

  const gate =
    evaluateAtlasExecutionAuthorizationGate(
      authorization
    );


  if (!gate.authorized) {
    return {
      allowed: false,
      reason: gate.reason,
    };
  }


  if (
    process.env.ATLAS_LIVE_ARMED !== "true"
  ) {
    return {
      allowed: false,
      reason: "atlas_live_not_armed",
    };
  }


  return {
    allowed: true,
    reason: "atlas_live_gateway_authorized",
    instruction,
  };
}