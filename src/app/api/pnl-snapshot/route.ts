// src/app/api/pnl-snapshot/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * SAFE USER PROXY (no secrets to browser)
 * - Requires Authorization: Bearer <supabase access token>
 * - Calls /api/pnl_snapshot_v1 with server secret + user_id
 * - Pass-through: since, limit
 */

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || "";
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: Request) {
  const runId = `pnl_proxy_${Math.random().toString(16).slice(2, 10)}`;

  try {
    // 1) Auth (Supabase access token)
    const token = getBearer(req);
    if (!token) return json(401, { ok: false, runId, error: "missing_bearer_token" });

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey =
      (process.env.SUPABASE_ANON_KEY || "").trim() ||
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

    if (!anonKey) return json(500, { ok: false, runId, error: "missing_env:SUPABASE_ANON_KEY" });

    const sb = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await sb.auth.getUser(token);

    if (userErr || !userData?.user?.id) {
      return json(401, { ok: false, runId, error: "invalid_token" });
    }

    const userId = userData.user.id;

    // 2) Params
    const url = new URL(req.url);
    const since = url.searchParams.get("since") || undefined;
    const limitRaw = Number(url.searchParams.get("limit") || "2000");
    const limit = clampInt(limitRaw, 1, 10000);

    // 3) Server secret for calling the admin engine (never returned to client)
    const secret =
      (process.env.CRON_SECRET || "").trim() ||
      (process.env.YC_CRON_SECRET || "").trim() ||
      (process.env.PNL_SNAPSHOT_SECRET || "").trim();

    if (!secret) {
      return json(500, { ok: false, runId, error: "missing_server_secret_env" });
    }

    // 4) Call the engine route (same deployment)
    const origin = new URL(req.url).origin;

    const qs = new URLSearchParams();
    qs.set("secret", secret);
    qs.set("user_id", userId);
    qs.set("limit", String(limit));
    if (since) qs.set("since", since);

    const engineUrl = `${origin}/api/pnl_snapshot_v1?${qs.toString()}`;

    const r = await fetch(engineUrl, { cache: "no-store" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j) {
      return json(500, {
        ok: false,
        runId,
        error: "engine_call_failed",
        status: r.status,
        details: j,
      });
    }

    // Pass through engine response (user-scoped by user_id)
    return json(200, j);
  } catch (e: any) {
    return json(500, { ok: false, runId, error: String(e?.message || e) });
  }
}