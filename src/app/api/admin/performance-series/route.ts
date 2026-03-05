import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USER_ID =
  process.env.ADMIN_USER_ID?.trim() || "295165f4-df46-403f-8727-80408d6a2578";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function sbService() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function okSupabaseAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  const supabase = sbService();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;

  return data.user.id === ADMIN_USER_ID;
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const ok = await okSupabaseAdmin(req);
    if (!ok) return json(401, { ok: false, error: "unauthorized" });

    const url = new URL(req.url);
    const days = Math.max(7, Math.min(365, num(url.searchParams.get("days"), 60)));

    const coreUserId =
      (url.searchParams.get("core_user_id") || process.env.CORE_FUND_USER_ID || "")
        .trim() || null;

    if (!coreUserId) {
      return json(200, { ok: true, days, core_user_id: null, series: [] });
    }

    const client = sbService();

    // Prefer pnl_snapshots time series if present
    const snap = await client
      .from("pnl_snapshots")
      .select("as_of,equity_usd,peak_equity_usd")
      .eq("user_id", coreUserId)
      .order("as_of", { ascending: true })
      .limit(days * 3); // loose cap

    if (!snap.error && Array.isArray(snap.data) && snap.data.length) {
      const series = snap.data
        .filter((r: any) => r?.as_of)
        .map((r: any) => ({
          t: r.as_of,
          equity: Number(r.equity_usd ?? r.last_equity_usd ?? null),
          peak: Number(r.peak_equity_usd ?? null),
        }))
        .filter((p: any) => Number.isFinite(p.equity));

      return json(200, { ok: true, source: "pnl_snapshots", days, core_user_id: coreUserId, series });
    }

    // Fallback: equity_state single point (no curve yet)
    const eq = await client
      .from("equity_state")
      .select("updated_at,last_equity_usd,peak_equity_usd")
      .eq("user_id", coreUserId)
      .maybeSingle();

    if (!eq.error && eq.data) {
      const series = [
        {
          t: eq.data.updated_at,
          equity: Number(eq.data.last_equity_usd),
          peak: Number(eq.data.peak_equity_usd),
        },
      ].filter((p: any) => Number.isFinite(p.equity));

      return json(200, { ok: true, source: "equity_state", days, core_user_id: coreUserId, series });
    }

    return json(200, { ok: true, source: "none", days, core_user_id: coreUserId, series: [] });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
}