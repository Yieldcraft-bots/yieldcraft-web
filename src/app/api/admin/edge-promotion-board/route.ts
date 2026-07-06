import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return value.trim();
}

function sbService() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    }
  );
}

export async function GET() {
  try {
    const client = sbService();

    const { data, error } = await client
      .from("edge_promotion_board_v1")
      .select("*")
      .order("promotion_status", { ascending: true })
      .order("avg_edge_bps", { ascending: false });

    if (error) {
      return json(500, {
        ok: false,
        status: "EDGE_PROMOTION_BOARD_READ_ERROR",
        error: error.message,
      });
    }

    return json(200, {
      ok: true,
      as_of: new Date().toISOString(),
      source: "edge_promotion_board_v1",
      candidates: data ?? [],
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      status: "EDGE_PROMOTION_BOARD_ERROR",
      error: e?.message || String(e),
    });
  }
}