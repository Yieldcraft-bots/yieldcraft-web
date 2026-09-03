export type AtlasOperationalStatus =
  | "READY"
  | "COOLDOWN"
  | "NEEDS_FUNDS";

export type AtlasOperationalStatusResult = {
  status: AtlasOperationalStatus;
  reason: string;
  cash_available_usd: number;
  cooldown_active: boolean;
};

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isCooldownActive(
  cooldownUntil?: string | null
) {
  if (!cooldownUntil) {
    return false;
  }

  const timestamp =
    new Date(cooldownUntil).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp > Date.now()
  );
}

export function deriveAtlasOperationalStatus(
  row: {
    last_cash_available_usd?: any;
    cooldown_until?: string | null;
    notes?: any;
  }
): AtlasOperationalStatusResult {
  const cash = num(
    row.last_cash_available_usd
  );

  const cooldownActive =
    isCooldownActive(
      row.cooldown_until
    );

  const notes = row.notes || {};

  const allocationReason = String(
    notes.allocation_reason ||
      notes.reason ||
      ""
  );

  if (cooldownActive) {
    return {
      status: "COOLDOWN",
      reason: "cooldown_active",
      cash_available_usd: cash,
      cooldown_active: true,
    };
  }

  if (
    allocationReason.includes(
      "below_min_cash"
    ) ||
    allocationReason.includes(
      "insufficient"
    ) ||
    allocationReason.includes("cash")
  ) {
    return {
      status: "NEEDS_FUNDS",
      reason: allocationReason,
      cash_available_usd: cash,
      cooldown_active: false,
    };
  }

  if (cash <= 0) {
    return {
      status: "NEEDS_FUNDS",
      reason:
        "cash_available_zero_or_missing",
      cash_available_usd: cash,
      cooldown_active: false,
    };
  }

  return {
    status: "READY",
    reason: "atlas_state_observed",
    cash_available_usd: cash,
    cooldown_active: false,
  };
}