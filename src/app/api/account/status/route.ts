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
 *  - public.subscriptions (latest by created_at)
 *
 * NOTE: DB schema uses created_at (NOT updated_at).
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

    // Verify user from token (do not rely on browser session)
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
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

    // Authed PostgREST client for RLS tables
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // entitlements: schema uses created_at
    const { data: ent, error: entErr } = await authed
      .from("entitlements")
      .select("pulse,recon,atlas,created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (entErr) {
      return json(500, {
        ok: false,
        error: "entitlements_read_failed",
        detail: entErr.message || entErr,
      });
    }

    // subscriptions: schema uses created_at
    const { data: sub, error: subErr } = await authed
      .from("subscriptions")
      .select(
        "plan,status,stripe_price_id,stripe_subscription_id,stripe_customer_id,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      return json(500, {
        ok: false,
        error: "subscriptions_read_failed",
        detail: subErr.message || subErr,
      });
    }

    return json(200, {
      ok: true,
      route: "api/account/status",
      user: { id: userId, email },
      entitlements: ent || { pulse: false, recon: false, atlas: false },
      subscription: sub || null,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "unknown_error" });
  }
}
