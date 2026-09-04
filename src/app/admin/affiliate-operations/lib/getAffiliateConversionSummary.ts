import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AffiliateConversionSummary } from "../types/affiliateOperations";

export async function getAffiliateConversionSummary(): Promise<AffiliateConversionSummary> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("affiliate_conversions")
    .select("amount,commission_amount,created_at");

  if (error) {
    console.error("Affiliate conversion summary error:", error);
    throw new Error("affiliate_conversion_summary_lookup_failed");
  }

  const rows = data ?? [];

  let totalReferredRevenue = 0;
  let totalRecordedCommission = 0;
  let latestConversionAt: string | null = null;

  for (const row of rows) {
    totalReferredRevenue += Number(row.amount || 0);
    totalRecordedCommission += Number(row.commission_amount || 0);

    if (
      row.created_at &&
      (!latestConversionAt ||
        new Date(row.created_at).getTime() >
          new Date(latestConversionAt).getTime())
    ) {
      latestConversionAt = row.created_at;
    }
  }

  return {
    totalConversions: rows.length,
    totalReferredRevenue: Number(totalReferredRevenue.toFixed(2)),
    totalRecordedCommission: Number(totalRecordedCommission.toFixed(2)),
    latestConversionAt,
  };
}