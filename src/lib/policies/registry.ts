// YieldCraft — Policy Registry (Floor 1)

import { PolicyDefinition } from './types'

// ⚠️ IMPORTANT:
// This registry is the SINGLE source of truth for all policies.
// Do not import policies directly into execution code.
// Pulse should ONLY read from evaluation output.

export const policyRegistry: PolicyDefinition[] = [
  {
    id: 'stable_low_vol_30m_bias',
    version: 'v1',

    // Start everything in SHADOW mode
    mode: 'shadow',

    // Lower number = higher priority
    priority: 100,

    evaluate: (ctx) => {
      const structure = ctx.structure.toLowerCase()
      const volatility_bps = ctx.volatility_bps
      const allowed = structure === 'stable' && volatility_bps < 10

      return {
        allowed,
        policy_id: 'stable_low_vol_30m_bias',
        policy_version: 'v1',
        reason: allowed
          ? 'shadow_match_stable_structure_low_volatility_30m_bias'
          : 'shadow_no_match_not_stable_or_vol_too_high',
        telemetry: {
          structure: ctx.structure,
          volatility_bps,
          target_horizon_minutes: 30,
          edge_basis: 'stable_structure_low_volatility_positive_30m_outcomes'
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
        allowed: false,
        policy_id: 'range_edge',
        policy_version: 'v1',
        reason: 'not_implemented',
        telemetry: {}
      }
    }
  }
]