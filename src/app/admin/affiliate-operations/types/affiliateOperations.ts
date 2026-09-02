export type AffiliateStatus =
  | "pending"
  | "active"
  | "disabled";

export interface AffiliateSummary {
  totalAffiliates: number;
  activeAffiliates: number;
  pendingAffiliates: number;
  stripeConnected: number;
  stripePending: number;
}

export interface AffiliateRecord {
  id: string;
  name: string;
  email: string;
  affiliateCode: string;
  status: AffiliateStatus;
  stripeConnected: boolean;
  commissionRate: number;
  createdAt: string;
}

export interface CoinbaseReferralSummary {
  clicksToday: number;
  clicks7d: number;
  clicks30d: number;
  pulseClicks30d: number;
  atlasClicks30d: number;
  identifiedUsers30d: number;
}