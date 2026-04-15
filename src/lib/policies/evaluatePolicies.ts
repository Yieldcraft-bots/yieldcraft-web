// YieldCraft — Policy Evaluator (Floor 1)

import {
  MarketContext,
  PolicyEvaluationResult,
  PolicyDefinition
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

  for (const policy of sortedPolicies) {
    // Skip retired policies
    if (policy.mode === 'retired') continue

    const result = policy.evaluate(ctx)

    evaluated_policies.push({
      policy_id: result.policy_id,
      allowed: result.allowed,
      reason: result.reason
    })

    // SHADOW mode: log only, never allow
    if (policy.mode === 'shadow') {
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

  return {
    allowed: final_allowed,
    winning_policy,
    winning_version,
    reason: final_reason,
    evaluated_policies,
    telemetry: {
      policies_evaluated: evaluated_policies.length
    }
  }
}