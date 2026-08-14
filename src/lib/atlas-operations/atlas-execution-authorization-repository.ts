/**
 * ============================================================
 * YieldCraft Atlas
 * Execution Authorization Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Define persistence boundary for execution authorization.
 *
 * SAFETY
 * - Persistence boundary only
 * - No trading
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Recon
 * - No API
 *
 * Implementations decide storage.
 * This interface does not perform persistence.
 * ============================================================
 */

import type {
  AtlasExecutionAuthorizationContract,
} from "./atlas-execution-authorization-contract";


export interface AtlasExecutionAuthorizationRepository {
  save(
    authorization: AtlasExecutionAuthorizationContract
  ): Promise<void>;


  load(
    authorizationId: string,
    userId: string
  ): Promise<AtlasExecutionAuthorizationContract | null>;
}