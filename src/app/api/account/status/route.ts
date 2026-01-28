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
 * Uses the logged-in user's Supabase session (Authorization: Bearer <access_token>)
 * and reads:
 *  - public.entitlements (by user_id)
 *  - public.subscriptions (by user_id)
 *
 * This is the SINGLE source-of-truth for:
 *  - Account page subscription status
 *  - Dashboard pills
 *  - Admin mission control (per-user checks later)
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
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return json(401, { ok: false, error: "invalid_session" });
    }

    const user = userRes.user;
    const userId = user.id;
    const email = (user.email || "").toLowerCase();

    // Pull entitlements (RLS should allow user to read their own row)
    const { data: ent, error: entErr } = await supabase
      .from("entitlements")
      .select("pulse,recon,atlas,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Pull subscription row (latest)
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select(
        "plan,status,stripe_price_id,stripe_subscription_id,stripe_customer_id,updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If tables are locked by RLS, you’ll see an error here — we’ll fix policies next.
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
