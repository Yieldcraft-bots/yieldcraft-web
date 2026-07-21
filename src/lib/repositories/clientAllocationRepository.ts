// src/lib/repositories/clientAllocationRepository.ts

import { supabaseAdmin } from "../supabaseAdmin";

export type ClientAllocationRow = {
  id: string;
  user_id: string;
  asset_symbol: string;
  target_percent: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const TABLE = "client_allocation_plans";

export async function getClientAllocationPlan(
  userId: string
): Promise<ClientAllocationRow[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("asset_symbol", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClientAllocationRow[];
}

export async function saveClientAllocationPlan(
  userId: string,
  allocations: readonly {
    symbol: string;
    targetPercent: number;
  }[]
): Promise<void> {
  const supabase = supabaseAdmin();

  const { error } = await supabase.rpc(
    "replace_client_allocation_plan",
    {
      p_user_id: userId,
      p_allocations: allocations,
    }
  );

  if (error) {
    throw error;
  }
}