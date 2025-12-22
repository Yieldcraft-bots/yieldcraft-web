// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function fetchLatestEntitlements(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("entitlements")
    .select("pulse, recon, atlas, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };

  return {
    ok: true as const,
    entitlements:
      data ?? { pulse: false, recon: false, atlas: false, created_at: null },
  };
}

export async function GET(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // 1) Cookie-based auth (SSR cookies)
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (user) {
      const ent = await fetchLatestEntitlements(supabase, user.id);
      if (!ent.ok) return json(500, { ok: false, error: ent.error });

      return json(200, {
        ok: true,
        user_id: user.id,
        entitlements: ent.entitlements,
        source: "cookie",
      });
    }
  } catch {
    // ignore and fall through
  }

  // 2) Bearer token auth (localStorage-style login)
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];

  if (!token) {
    return json(401, { ok: false, error: "not_authenticated" });
  }

  // IMPORTANT: attach token to ALL requests so RLS + auth.uid() works
  const authed = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userRes, error: userErr } = await authed.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user) {
    return json(401, { ok: false, error: "not_authenticated" });
  }

  const ent = await fetchLatestEntitlements(authed, user.id);
  if (!ent.ok) return json(500, { ok: false, error: ent.error });

  return json(200, {
    ok: true,
    user_id: user.id,
    entitlements: ent.entitlements,
    source: "bearer",
  });
}
