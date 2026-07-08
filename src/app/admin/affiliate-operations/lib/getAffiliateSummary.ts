import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AffiliateSummary } from "../types/affiliateOperations";

export async function getAffiliateSummary(): Promise<AffiliateSummary> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("affiliates")
    .select("status,stripe_account_id");

  if (error || !data) {
    return {
      totalAffiliates: 0,
      activeAffiliates: 0,
      pendingAffiliates: 0,
      stripeConnected: 0,
      stripePending: 0,
    };
  }

  const totalAffiliates = data.length;
  const activeAffiliates = data.filter((row) => row.status === "active").length;
  const pendingAffiliates = data.filter((row) => row.status === "pending").length;
  const stripeConnected = data.filter((row) => !!row.stripe_account_id).length;

  return {
    totalAffiliates,
    activeAffiliates,
    pendingAffiliates,
    stripeConnected,
    stripePending: totalAffiliates - stripeConnected,
  };
}