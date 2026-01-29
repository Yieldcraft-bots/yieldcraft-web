// src/app/api/account/status/route.ts
import { NextResponse } from "next/server";
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

/**
 * Uses the logged-in user's Supabase access token:
 *   Authorization: Bearer <access_token>
 *
 * Reads:
 *  - public.entitlements (by user_id)
 *  - public.subscriptions (by user_id, first row if multiple)
 *
 * This is the SINGLE source-of-truth for:
 *  - Account page subscription status
 *  - Dashboard pills
 */
export async function GET(req: Request) {
  try {
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return json(401, { ok: false, error: "missing_bearer_token" });
    }

    // Auth client (explicit token)
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return json(401, {
        ok: false,
        error: "invalid_session",
        detail: userErr?.message || null,
      });
    }

    const user = userRes.user;
    const userId = user.id;
    const email = (user.email || "").toLowerCase();

    // RLS-aware PostgREST client (Bearer token in headers)
    const db = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // ENTITLEMENTS: select only known columns (NO updated_at dependency)
    const { data: entRows, error: entErr } = await db
      .from("entitlements")
      .select("pulse,recon,atlas")
      .eq("user_id", userId)
      .limit(1);

    if (entErr) {
      return json(500, {
        ok: false,
        error: "entitlements_read_failed",
        detail: entErr.message || entErr,
      });
    }

    const ent = (entRows && entRows[0]) || null;

    // SUBSCRIPTIONS: schema-proof (select *) and don’t assume column names
    // Also avoid maybeSingle() so multiple rows never error.
    const { data: subRows, error: subErr } = await db
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .limit(1);

    if (subErr) {
      return json(500, {
        ok: false,
        error: "subscriptions_read_failed",
        detail: subErr.message || subErr,
      });
    }

    const sub = (subRows && subRows[0]) || null;

    return json(200, {
      ok: true,
      route: "api/account/status",
      user: { id: userId, email },
      entitlements: ent || { pulse: false, recon: false, atlas: false },
      subscription: sub,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "unknown_error" });
  }
}
