// YieldCraft — Policy Engine Types (Floor 1 Foundation)

export type MarketContext = {
  product_id: string

  // Market state
  regime: string
  structure: string
  volatility_bps: number

  // Signal inputs
  confidence?: number | null

  // Range context (for range-based edges)
  price_position_pct?: number | null
  near_lower_band?: boolean
  near_upper_band?: boolean
  range_width_bps?: number | null

  // Execution context
  has_position: boolean
  entry_locked: boolean
  cooldown_blocked: boolean

  // Risk state
  equity_defense: boolean
}

export type PolicyDecision = {
  allowed: boolean

  // Identity
  policy_id: string
  policy_version: string

  // Explanation
  reason: string

  // Debug / analysis
  telemetry: Record<string, unknown>
}

export type PolicyEvaluationResult = {
  allowed: boolean

  // Winning policy (if any)
  winning_policy: string | null
  winning_version: string | null

  // Why final decision was made
  reason: string

  // All policies evaluated
  evaluated_policies: Array<{
    policy_id: string
    allowed: boolean
    reason: string
  }>

  // Global telemetry
  telemetry: Record<string, unknown>
}

export type PolicyMode =
  | 'draft'
  | 'shadow'
  | 'canary'
  | 'live'
  | 'retired'

export type PolicyDefinition = {
  id: string
  version: string

  // lifecycle control
  mode: PolicyMode

  // priority (lower = evaluated first)
  priority: number

  // core logic
  evaluate: (ctx: MarketContext) => PolicyDecision
}