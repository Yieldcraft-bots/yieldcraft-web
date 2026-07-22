/**
 * ============================================================
 * Portfolio State Repository
 * ------------------------------------------------------------
 * PURPOSE
 * Single persistence boundary for Atlas portfolio state.
 *
 * This layer does NOT:
 * - Execute trades
 * - Call Coinbase
 * - Build orders
 * - Apply allocation policy
 *
 * It ONLY defines the repository contract used by Atlas.
 * ============================================================
 */

import type { AtlasPortfolioState } from "./atlas-portfolio-state";

export interface PortfolioStateRepository {
  load(userId: string): Promise<AtlasPortfolioState | null>;

  save(state: AtlasPortfolioState): Promise<void>;
}

export class InMemoryPortfolioStateRepository
  implements PortfolioStateRepository
{
  private readonly store = new Map<string, AtlasPortfolioState>();

  async load(
    userId: string
  ): Promise<AtlasPortfolioState | null> {
    return this.store.get(userId) ?? null;
  }

  async save(
    state: AtlasPortfolioState
  ): Promise<void> {
    this.store.set(state.userId, state);
  }
}