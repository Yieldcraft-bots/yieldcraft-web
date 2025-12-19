import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET() {
  try {
    const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // Next 16: cookies() is async
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Route handlers shouldn’t try to set auth cookies
        // (and we don’t need to for a read endpoint)
        setAll() {},
      },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user || userErr) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("entitlements")
      .select("pulse, recon, atlas")
      .eq("user_id", user.id)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, entitlements: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}
