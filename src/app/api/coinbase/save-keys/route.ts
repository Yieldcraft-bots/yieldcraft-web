import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

type Body = {
  api_key_name: string;
  private_key: string;
  key_alg?: string; // "ed25519" | "ES256" etc (default ed25519)
};

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 1) Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 2) Parse + validate input
    const body = (await req.json()) as Partial<Body>;

    const api_key_name = (body.api_key_name ?? "").trim();
    const private_key = (body.private_key ?? "").trim();
    const key_alg = (body.key_alg ?? "ed25519").trim();

    if (!api_key_name || !private_key) {
      return NextResponse.json(
        { ok: false, error: "Missing api_key_name or private_key" },
        { status: 400 }
      );
    }

    // 3) Upsert into coinbase_keys scoped to this user (RLS enforces ownership)
    const { error: upsertError } = await supabase.from("coinbase_keys").upsert(
      {
        user_id: user.id,
        api_key_name,
        private_key,
        key_alg,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: "Failed to save keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("coinbase/save-keys error", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
