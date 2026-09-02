import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CoinbaseReferralSummary } from "../types/affiliateOperations";

type CoinbaseReferralClickRow = {
  user_id: string | null;
  campaign: string | null;
  created_at: string;
};

export async function getCoinbaseReferralSummary(): Promise<CoinbaseReferralSummary> {
  const sb = supabaseAdmin();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await sb
    .from("coinbase_referral_clicks")
    .select("user_id,campaign,created_at")
    .gte("created_at", start30d.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) {
    return {
      clicksToday: 0,
      clicks7d: 0,
      clicks30d: 0,
      pulseClicks30d: 0,
      atlasClicks30d: 0,
      identifiedUsers30d: 0,
    };
  }

  const rows = data as CoinbaseReferralClickRow[];

  const clicksToday = rows.filter(
    (row) => new Date(row.created_at) >= startOfToday
  ).length;

  const clicks7d = rows.filter(
    (row) => new Date(row.created_at) >= start7d
  ).length;

  const pulseClicks30d = rows.filter(
    (row) => row.campaign === "quickstart"
  ).length;

  const atlasClicks30d = rows.filter(
    (row) => row.campaign === "atlas_quickstart"
  ).length;

  const identifiedUsers30d = new Set(
    rows
      .map((row) => row.user_id)
      .filter((userId): userId is string => Boolean(userId))
  ).size;

  return {
    clicksToday,
    clicks7d,
    clicks30d: rows.length,
    pulseClicks30d,
    atlasClicks30d,
    identifiedUsers30d,
  };
}