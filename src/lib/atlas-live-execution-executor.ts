/**
 * ============================================================
 * YieldCraft Atlas
 * Live Execution Executor
 *
 * PURPOSE
 * Controlled live execution boundary for Atlas instructions.
 *
 * SAFETY
 * - Requires authorization proof
 * - Requires live gateway approval
 * - Requires idempotency fingerprint
 * - No UI access
 * - No Pulse
 * - No Recon
 * - No policy mutation
 *
 * This file owns live execution only.
 * ============================================================
 */

import type {
  AtlasExecutionInstruction,
} from "./atlas-execution-adapter";

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-operations/atlas-execution-authorization-contract";

import {
  evaluateAtlasLiveExecutionGateway,
} from "./atlas-live-execution-gateway";

import {
  createAtlasExecutionFingerprint,
} from "./atlas-live-execution-idempotency";

import {
  submitAtlasLiveCoinbaseOrder,
} from "./atlas-live-coinbase-adapter";


export interface AtlasLiveExecutionExecutorResult {
  success: boolean;
  submitted: boolean;
  response: unknown;
}


export async function executeAtlasLiveInstruction(
  instruction: AtlasExecutionInstruction,
  authorization: AtlasExecutionAuthorizationContract
): Promise<AtlasLiveExecutionExecutorResult> {

  const gateway =
    evaluateAtlasLiveExecutionGateway(
      authorization,
      instruction
    );


  if (!gateway.allowed) {
    return {
      success: false,
      submitted: false,
      response: {
        mode: "live",
        reason: gateway.reason,
      },
    };
  }


  const fingerprint =
    createAtlasExecutionFingerprint({
      userId: authorization.userId,
      authorizationId:
        authorization.authorizationId,
      productId:
        instruction.productId,
      quoteSizeUsd:
        instruction.quoteSizeUsd,
    });


  const coinbaseResult =
    await submitAtlasLiveCoinbaseOrder(
      instruction
    );


  return {
    success:
      coinbaseResult.success,
    submitted:
      coinbaseResult.submitted,
    response: {
      mode: "live",
      fingerprint,
      authorizationId:
        authorization.authorizationId,
      coinbase:
        coinbaseResult.response,
    },
  };
}