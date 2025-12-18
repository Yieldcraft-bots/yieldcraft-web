// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // IMPORTANT:
  // - This endpoint is SAFE: it does not expose secrets.
  // - It only reports whether key env vars exist (true/false).
  // - Use this for "site online" + "auth configured" checks.

  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json(
    {
      ok: true,
      app: process.env.NEXT_PUBLIC_APP_NAME || "YieldCraft",
      time: new Date().toISOString(),

      // Config health (no secrets)
      supabase_configured: hasSupabaseUrl && hasSupabaseAnon,
      supabase_url_set: hasSupabaseUrl,
      supabase_anon_set: hasSupabaseAnon,

      // Future flags you can wire later (kept boolean-only)
      trading_enabled: process.env.COINBASE_TRADING_ENABLED === "true",
      bot_enabled: process.env.BOT_ENABLED === "true",
    },
    { status: 200 }
  );
}
