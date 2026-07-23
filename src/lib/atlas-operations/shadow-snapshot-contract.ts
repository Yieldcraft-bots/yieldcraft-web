/**
 * ============================================================
 * Atlas Operations
 * Shadow Snapshot Contract
 * ------------------------------------------------------------
 * PURPOSE
 * Define the immutable contract for a persisted Atlas shadow
 * execution snapshot.
 *
 * This contract is shared by:
 * - future repository layer
 * - future admin API
 * - future Atlas Operations dashboard
 *
 * SAFETY
 * - Read only
 * - Types only
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Atlas execution
 * - No database
 * ============================================================
 */

import type { AtlasExecutionBridgeResult } from "@/lib/atlas-execution-bridge";

export interface AtlasShadowSnapshot {
  generatedAt: string;
  report: AtlasExecutionBridgeResult;
}

export interface AtlasShadowSnapshotRepository {
  latest(): Promise<AtlasShadowSnapshot | null>;
}