// src/app/api/user-keys-test/route.ts
// READ-ONLY DIAGNOSTIC: proves we can fetch a user's stored Coinbase keys from Supabase.
// DOES NOT TRADE. DOES NOT RETURN PRIVATE KEY.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Safely decode JWT payload (no verification) to see what "role" this key likely has.
// This does NOT expose the key; it only reports a claim string like "service_role" / "anon".
function jwtRoleHint(jwt: string | undefined | null): string | null {
  try {
    if (!jwt) return null;
    const parts = jwt.split(".");
    if (parts.length < 2) return "not_jwt";
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const jsonStr = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const obj = JSON.parse(jsonStr);
    return typeof obj?.role === "string" ? obj.role : "no_role_claim";
  } catch {
    return "decode_failed";
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return json(400, { ok: false, error: "Missing query param: user_id" });

  // We don't enforce the secret here because you're already using it as a convenience gate in your workflow.
  // (If you want, we can enforce it later.)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;

  // This is safe to report as a boolean + role hint; do NOT print the key itself.
  const serviceKeyPresent = !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim());
  const serviceKeyRoleHint = jwtRoleHint(process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const sb = supabaseAdmin();

    // 1) lightweight "can we see anything for this user_id" check
    const q1 = await sb
      .from("coinbase_keys")
      .select("id, key_alg, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (q1.error) {
      return json(200, {
        ok: true,
        found: false,
        db: { supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null, table: "coinbase_keys" },
        env: { serviceKeyPresent, serviceKeyRoleHint, nodeEnv: process.env.NODE_ENV || null, vercelEnv: process.env.VERCEL_ENV || null },
        query: { error: q1.error.message, hint: (q1.error as any).hint ?? null, code: (q1.error as any).code ?? null },
      });
    }

    const row = (q1.data && q1.data[0]) ? q1.data[0] : null;

    return json(200, {
      ok: true,
      found: !!row,
      db: { supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null, table: "coinbase_keys" },
      env: { serviceKeyPresent, serviceKeyRoleHint, nodeEnv: process.env.NODE_ENV || null, vercelEnv: process.env.VERCEL_ENV || null },
      meta: {
        count: q1.count ?? null,
        newestRow: row
          ? { idTail: String(row.id).slice(-6), keyAlg: row.key_alg ?? null, createdAt: row.created_at ?? null }
          : null,
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: String(e?.message || e),
      env: { serviceKeyPresent, serviceKeyRoleHint, nodeEnv: process.env.NODE_ENV || null, vercelEnv: process.env.VERCEL_ENV || null },
    });
  }
}
