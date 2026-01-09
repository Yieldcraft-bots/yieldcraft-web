import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type Body = {
  api_key_name: string;
  private_key: string;
  key_alg?: string; // default "ed25519"
};

function supabaseFromCookies() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // Not needed for this route; auth session cookie already exists.
        },
        remove() {
          // Not needed.
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseFromCookies();

    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user || authError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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
      console.error("upsert coinbase_keys error", upsertError);
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
