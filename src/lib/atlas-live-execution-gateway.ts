/**
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Live Execution Gateway
 *
 * PURPOSE
 * Controlled boundary between authorized Atlas Multi-Asset
 * state and live execution.
 *
 * SAFETY
 * - Requires valid authorization
 * - Requires AUTHORIZED status
 * - Requires ATLAS_MULTI_ASSET_LIVE_ARMED=true
 * - Requires ATLAS_MULTI_ASSET_DRY_RUN=false
 * - Independent from legacy Atlas live controls
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 * - No order submission in this layer
 *
 * This file only decides whether Multi-Asset live execution
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
      reason:
        gate.reason,
    };
  }


  /*
   * Dedicated Multi-Asset live arm.
   *
   * Legacy ATLAS_LIVE_ARMED is intentionally
   * NOT consulted here.
   */
  if (
    process.env
      .ATLAS_MULTI_ASSET_LIVE_ARMED !==
    "true"
  ) {
    return {
      allowed: false,
      reason:
        "atlas_multi_asset_live_not_armed",
    };
  }


  /*
   * Defense-in-depth dry-run boundary.
   *
   * Even if a caller reaches this gateway, live execution
   * remains blocked unless Multi-Asset dry-run is explicitly
   * disabled.
   */
  if (
    process.env
      .ATLAS_MULTI_ASSET_DRY_RUN !==
    "false"
  ) {
    return {
      allowed: false,
      reason:
        "atlas_multi_asset_dry_run_enabled",
    };
  }


  return {
    allowed: true,
    reason:
      "atlas_multi_asset_live_gateway_authorized",
    instruction,
  };
}