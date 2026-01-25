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

function jwtRoleHint(jwt: string | undefined | null): string | null {
  try {
    if (!jwt) return null;
    const parts = jwt.split(".");
    if (parts.length < 2) return "not_jwt";
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const jsonStr = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const obj = JSON.parse(jsonStr);
    return typeof obj?.role === "string" ? obj.role : "no_role_claim";
  } catch {
    return "decode_failed";
  }
}

type KeyMeta = {
  api_key_name?: string | null;
  private_key?: string | null;
  key_alg?: string | null;
  created_at?: string | null;
};

async function latestFromTable(sb: any, table: string, userId: string) {
  // We only select columns that exist in BOTH schemas (and avoid "id").
  // If table doesn't exist, Supabase returns an error we capture.
  const q = await sb
    .from(table)
    .select("api_key_name, private_key, key_alg, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  return q;
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return json(400, { ok: false, error: "Missing query param: user_id" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;

  const serviceKeyPresent = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  );
  const serviceKeyRoleHint = jwtRoleHint(process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const sb = supabaseAdmin();

    // 1) Prefer newer table (if it exists)
    const qNew = await latestFromTable(sb, "user_coinbase_keys", userId);
    if (!qNew.error) {
      const row: KeyMeta | null = (qNew.data?.[0] as any) ?? null;
      const hasKeyName = !!row?.api_key_name;
      const hasPrivateKey = !!row?.private_key;

      return json(200, {
        ok: true,
        found: hasKeyName && hasPrivateKey,
        db: {
          supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null,
          sourceTable: "user_coinbase_keys",
        },
        env: {
          serviceKeyPresent,
          serviceKeyRoleHint,
          nodeEnv: process.env.NODE_ENV || null,
          vercelEnv: process.env.VERCEL_ENV || null,
        },
        meta: {
          count: qNew.count ?? null,
          newestRow: row
            ? {
                apiKeyNameTail: row.api_key_name ? String(row.api_key_name).slice(-6) : null,
                keyAlg: row.key_alg ?? null,
                createdAt: row.created_at ?? null,
                hasKeyName,
                hasPrivateKey,
              }
            : null,
        },
      });
    }

    // 2) Fallback to legacy table
    const qLegacy = await latestFromTable(sb, "coinbase_keys", userId);

    if (qLegacy.error) {
      return json(200, {
        ok: true,
        found: false,
        db: {
          supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null,
          sourceTable: "coinbase_keys",
        },
        env: {
          serviceKeyPresent,
          serviceKeyRoleHint,
          nodeEnv: process.env.NODE_ENV || null,
          vercelEnv: process.env.VERCEL_ENV || null,
        },
        query: {
          error: qLegacy.error.message,
          hint: (qLegacy.error as any).hint ?? null,
          code: (qLegacy.error as any).code ?? null,
        },
      });
    }

    const row: KeyMeta | null = (qLegacy.data?.[0] as any) ?? null;
    const hasKeyName = !!row?.api_key_name;
    const hasPrivateKey = !!row?.private_key;

    return json(200, {
      ok: true,
      found: hasKeyName && hasPrivateKey,
      db: {
        supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null,
        sourceTable: "coinbase_keys",
      },
      env: {
        serviceKeyPresent,
        serviceKeyRoleHint,
        nodeEnv: process.env.NODE_ENV || null,
        vercelEnv: process.env.VERCEL_ENV || null,
      },
      meta: {
        count: qLegacy.count ?? null,
        newestRow: row
          ? {
              apiKeyNameTail: row.api_key_name ? String(row.api_key_name).slice(-6) : null,
              keyAlg: row.key_alg ?? null,
              createdAt: row.created_at ?? null,
              hasKeyName,
              hasPrivateKey,
            }
          : null,
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: String(e?.message || e),
      env: {
        serviceKeyPresent,
        serviceKeyRoleHint,
        nodeEnv: process.env.NODE_ENV || null,
        vercelEnv: process.env.VERCEL_ENV || null,
      },
    });
  }
}
