// src/app/api/entitlements/route.ts
// Returns the signed-in user's entitlements (pulse/recon/atlas, etc.)
// Safe: only returns the caller's own row.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type EntitlementsRow = {
  user_id: string;
  pulse: boolean;
  recon: boolean;
  atlas: boolean;
  max_trade_size: number | null;
  risk_mode: string | null;
  created_at: string;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: Request) {
  try {
    // Server-side Supabase (service role) so we can read public.entitlements reliably
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    // Read the user's access token from the request cookies (supabase-js stores it there)
    const cookieHeader = req.headers.get("cookie") || "";

    // Ask Supabase who the user is, using the cookie session
    const supabaseAuth = createClient(
      supabaseUrl,
      mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      {
        auth: { persistSession: false },
        global: { headers: { cookie: cookieHeader } },
      }
    );

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    const { data, error } = await supabaseAdmin
      .from("entitlements")
      .select("user_id,pulse,recon,atlas,max_trade_size,risk_mode,created_at")
      .eq("user_id", userId)
      .maybeSingle<EntitlementsRow>();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 }
      );
    }

    // If the row doesn't exist yet, return safe defaults (shouldn't happen after your triggers/backfill)
    const ent = data || {
      user_id: userId,
      pulse: false,
      recon: false,
      atlas: false,
      max_trade_size: 0,
      risk_mode: "safe",
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, entitlements: ent }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
