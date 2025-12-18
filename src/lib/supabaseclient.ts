// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * IMPORTANT:
 * - We never export a nullable client (avoids TS "possibly null").
 * - We do NOT throw at import-time (prevents build failures if env vars are missing).
 * - If env vars are missing, we still create a client with empty strings.
 *   Your auth checks will fail safely and you can redirect to /login.
 */
export const supabase: SupabaseClient = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Optional helper if you want a clean “configured?” check anywhere
export function supabaseConfigured(): boolean {
  return !!(url && anon);
}
