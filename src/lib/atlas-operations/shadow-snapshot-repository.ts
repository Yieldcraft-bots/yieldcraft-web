/**
 * ============================================================
 * Atlas Operations
 * Shadow Snapshot Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Define the read-only repository boundary used to retrieve
 * the latest persisted Atlas shadow execution snapshot.
 *
 * IMPLEMENTATION
 * Storage is intentionally undefined. Future implementations
 * may use Supabase or another persistence layer.
 *
 * SAFETY
 * - Read only
 * - Interface only
 * - No database
 * - No execution
 * - No Coinbase
 * - No Pulse
 * - No Atlas execution
 * ============================================================
 */

import type {
  AtlasShadowSnapshot,
} from "./shadow-snapshot-contract";

export interface AtlasShadowSnapshotRepository {
  /**
   * Returns the newest available shadow snapshot.
   */
  getLatest(): Promise<AtlasShadowSnapshot | null>;
}