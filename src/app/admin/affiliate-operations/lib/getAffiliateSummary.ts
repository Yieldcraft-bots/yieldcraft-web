import type { AffiliateSummary } from "../types/affiliateOperations";

export function getAffiliateSummaryPlaceholder(): AffiliateSummary {
  return {
    totalAffiliates: 0,
    activeAffiliates: 0,
    pendingAffiliates: 0,
    stripeConnected: 0,
    stripePending: 0,
  };
}