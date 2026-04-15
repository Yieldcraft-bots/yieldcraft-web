// YieldCraft — Policy Registry (Floor 1)

import { PolicyDefinition } from './types'

// ⚠️ IMPORTANT:
// This registry is the SINGLE source of truth for all policies.
// Do not import policies directly into execution code.
// Pulse should ONLY read from evaluation output.

export const policyRegistry: PolicyDefinition[] = [
  {
    id: 'range_edge',
    version: 'v1',

    // Start everything in SHADOW mode
    mode: 'shadow',

    // Lower number = higher priority
    priority: 100,

    // Placeholder logic (does nothing yet)
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