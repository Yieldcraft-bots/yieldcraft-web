// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: Request) {
  try {
    const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // IMPORTANT:
    // Browser login lives in localStorage, so the server won't see it.
    // We require the client to pass the access token in:
    // Authorization: Bearer <supabase_access_token>
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    // Create a supabase client that uses the user's JWT for RLS-scoped reads
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const { data: ent, error: entErr } = await supabase
      .from("entitlements")
      .select("pulse,recon,atlas,max_trade_size,risk_mode,created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entErr) {
      return NextResponse.json({ ok: false, error: "entitlements_query_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      entitlements: ent ?? {
        pulse: false,
        recon: false,
        atlas: false,
        max_trade_size: 0,
        risk_mode: "safe",
        created_at: null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
