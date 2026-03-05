"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

type SessState = "loading" | "authed" | "guest";

export default function AuthNav() {
  const router = useRouter();
  const [state, setState] = useState<SessState>("loading");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = sessionData?.session ?? null;
      setState(session ? "authed" : "guest");
      setIsAdmin(session?.user?.id === ADMIN_USER_ID);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setState(session ? "authed" : "guest");
      setIsAdmin(session?.user?.id === ADMIN_USER_ID);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (state === "loading") {
    return <span className="text-sm text-white/50">…</span>;
  }

  if (state === "guest") {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Login
        </Link>

        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow transition hover:brightness-110"
        >
          Join
        </Link>
      </div>
    );
  }

  // AUThed
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/live"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
      >
        Live
      </Link>

      {isAdmin ? (
        <Link
          href="/admin"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Mission Control
        </Link>
      ) : (
        <Link
          href="/dashboard"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Dashboard
        </Link>
      )}

      <Link
        href="/account"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
      >
        Account
      </Link>

      <button
        onClick={handleLogout}
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
      >
        Logout
      </button>
    </div>
  );
}