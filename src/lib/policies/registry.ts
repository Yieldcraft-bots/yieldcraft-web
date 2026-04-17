// YieldCraft — Policy Registry (Floor 1)

import { PolicyDefinition } from './types'

// ⚠️ IMPORTANT:
// This registry is the SINGLE source of truth for all policies.
// Do not import policies directly into execution code.
// Pulse should ONLY read from evaluation output.

export const policyRegistry: PolicyDefinition[] = [
  {
    id: 'time_kill_360',
    version: 'v1',

    // Start in SHADOW mode only
    mode: 'shadow',

    // Lower number = higher priority
    priority: 10,

    evaluate: (ctx) => {
      const hold = ctx.hold_minutes ?? null
      const pnl = ctx.pnl_bps ?? null

      const triggered =
        typeof hold === 'number' &&
        typeof pnl === 'number' &&
        hold > 360 &&
        pnl <= 0

      return {
        // Shadow only — never influence execution
        allowed: true,
        policy_id: 'time_kill_360',
        policy_version: 'v1',
        reason: triggered
          ? 'shadow_time_kill_360_triggered'
          : 'shadow_pass',
        telemetry: {
          triggered,
          hold_minutes: hold,
          pnl_bps: pnl,
          edge_basis:
            'historical_loss_cluster_over_360_minutes_when_not_in_profit'
        }
      }
    }
  },

  {
    id: 'stable_low_vol_30m_bias',
    version: 'v1',

    // Start everything in SHADOW mode
    mode: 'shadow',

    // Lower number = higher priority
    priority: 100,

    evaluate: (ctx) => {
      const structure =
        typeof ctx.structure === 'string' ? ctx.structure.toLowerCase() : ''
      const volatility_bps = ctx.volatility_bps ?? null

      const matched =
        structure === 'stable' &&
        typeof volatility_bps === 'number' &&
        volatility_bps < 10

      return {
        // Shadow only — never influence execution
        allowed: true,
        policy_id: 'stable_low_vol_30m_bias',
        policy_version: 'v1',
        reason: matched
          ? 'shadow_match_stable_structure_low_volatility_30m_bias'
          : 'shadow_no_match_not_stable_or_vol_too_high',
        telemetry: {
          matched,
          structure: ctx.structure ?? null,
          volatility_bps,
          target_horizon_minutes: 30,
          edge_basis:
            'stable_structure_low_volatility_positive_30m_outcomes'
        }
      }
    }
  },

  {
    id: 'range_edge',
    version: 'v1',

    mode: 'shadow',
    priority: 200,

    evaluate: () => {
      return {
        // Shadow only — never influence execution
        allowed: true,
        policy_id: 'range_edge',
        policy_version: 'v1',
        reason: 'not_implemented',
        telemetry: {
          triggered: false
        }
      }
    }
  }
]