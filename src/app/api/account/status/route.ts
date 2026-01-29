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
 *  - public.subscriptions (latest by user_id)
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

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // IMPORTANT: pass token explicitly (do NOT rely on global headers/session storage)
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return json(401, {
        ok: false,
        error: "invalid_session",
        detail: userErr?.message,
      });
    }

    const user = userRes.user;
    const userId = user.id;
    const email = (user.email || "").toLowerCase();

    // Use the same token for PostgREST RLS
    const authed = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // ✅ FIX: entitlements table does NOT have updated_at in your DB
    const { data: ent, error: entErr } = await authed
      .from("entitlements")
      .select("pulse,recon,atlas")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: sub, error: subErr } = await authed
      .from("subscriptions")
      .select(
        "plan,status,stripe_price_id,stripe_subscription_id,stripe_customer_id,updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (entErr) {
      return json(500, {
        ok: false,
        error: "entitlements_read_failed",
        detail: entErr.message || entErr,
      });
    }

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
