import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getAffiliateRoster() {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("affiliates")
    .select(
      `
      id,
      name,
      email,
      affiliate_code,
      status,
      commission_rate,
      stripe_account_id,
      created_at
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Affiliate roster error:", error);
    return [];
  }

  return data ?? [];
}