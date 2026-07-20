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

  // Remove the user's existing allocation plan.
  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }

  // Allow an empty plan (used if a client clears allocations).
  if (allocations.length === 0) {
    return;
  }

  const rows = allocations.map((allocation) => ({
    user_id: userId,
    asset_symbol: allocation.symbol,
    target_percent: allocation.targetPercent,
    enabled: true,
  }));

  const { error: insertError } = await supabase
    .from(TABLE)
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}