// src/app/api/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // 1) Try cookie-based auth (works if you’re using SSR auth cookies)
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route handlers can't reliably set cookies (and we don't need to here).
        },
      },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (user && !userErr) {
      const { data, error } = await supabase
        .from("entitlements")
        .select("pulse, recon, atlas, created_at")
        .eq("user_id", user.id)
        .single();

      if (error) return json(500, { ok: false, error: error.message });

      return json(200, {
        ok: true,
        user_id: user.id,
        entitlements: data,
        source: "cookie",
      });
    }
  } catch {
    // Ignore and fall through to Bearer token path
  }

  // 2) Fallback: Bearer token auth (works with your current localStorage-style login)
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];

  if (!token) {
    return json(401, { ok: false, error: "not_authenticated" });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  const user = userRes?.user;

  if (userErr || !user) {
    return json(401, { ok: false, error: "not_authenticated" });
  }

  const { data, error } = await supabase
    .from("entitlements")
    .select("pulse, recon, atlas, created_at")
    .eq("user_id", user.id)
    .single();

  if (error) return json(500, { ok: false, error: error.message });

  return json(200, {
    ok: true,
    user_id: user.id,
    entitlements: data,
    source: "bearer",
  });
}
