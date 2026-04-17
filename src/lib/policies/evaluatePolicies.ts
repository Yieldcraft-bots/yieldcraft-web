// YieldCraft — Policy Evaluator (Floor 1)

import {
  MarketContext,
  PolicyEvaluationResult,
  PolicyDefinition,
} from './types'
import { policyRegistry } from './registry'

// Core evaluation engine
export function evaluatePolicies(ctx: MarketContext): PolicyEvaluationResult {
  // Sort policies by priority (lowest = highest priority)
  const sortedPolicies: PolicyDefinition[] = [...policyRegistry].sort(
    (a, b) => a.priority - b.priority
  )

  const evaluated_policies: Array<{
    policy_id: string
    allowed: boolean
    reason: string
  }> = []

  let winning_policy: string | null = null
  let winning_version: string | null = null
  let final_allowed = false
  let final_reason = 'no_policy_allowed'

  // Shadow-only observability
  let shadow_policy: string | null = null
  let shadow_version: string | null = null
  let shadow_reason: string | null = null

  for (const policy of sortedPolicies) {
    // Skip retired policies
    if (policy.mode === 'retired') continue

    const result = policy.evaluate(ctx)

    evaluated_policies.push({
      policy_id: result.policy_id,
      allowed: result.allowed,
      reason: result.reason,
    })

    // SHADOW mode: log/label only, never affect execution
    if (policy.mode === 'shadow') {
      if (shadow_policy === null && result.reason !== 'shadow_pass') {
        shadow_policy = result.policy_id
        shadow_version = result.policy_version
        shadow_reason = result.reason
      }
      continue
    }

    // If policy is active and allows entry, take it
    if (!final_allowed && result.allowed) {
      final_allowed = true
      winning_policy = result.policy_id
      winning_version = result.policy_version
      final_reason = result.reason

      // Stop after first valid policy (deterministic control)
      break
    }
  }

  // If no active policy allowed anything, surface first shadow signal for observability
  if (!final_allowed && shadow_policy) {
    winning_policy = shadow_policy
    winning_version = shadow_version
    final_reason = shadow_reason ?? final_reason
  }

  return {
    allowed: final_allowed,
    winning_policy,
    winning_version,
    reason: final_reason,
    evaluated_policies,
    telemetry: {
      policies_evaluated: evaluated_policies.length,
      shadow_policy,
      shadow_version,
      shadow_reason,
    },
  }
}