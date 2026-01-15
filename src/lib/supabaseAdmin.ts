// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

// IMPORTANT: Service role key must ONLY be used server-side (api routes / server actions)
export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");

  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function getUserCoinbaseKeys(userId: string) {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("coinbase_keys")
    .select("api_key_name, private_key, key_alg")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`coinbase_keys lookup failed: ${error.message}`);
  if (!data?.api_key_name || !data?.private_key) return null;

  return {
    apiKeyName: data.api_key_name as string,
    privateKey: data.private_key as string,
    keyAlg: (data.key_alg as string | null) || null,
  };
}
