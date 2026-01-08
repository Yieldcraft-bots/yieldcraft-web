// src/components/AuthNav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SessState = "loading" | "authed" | "guest";

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SessState>("loading");

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setState(data?.session ? "authed" : "guest");
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setState(session ? "authed" : "guest");
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  // Avoid layout jump
  if (state === "loading") {
    return <span className="text-sm text-white/50">…</span>;
  }

  // 🔓 Logged OUT
  if (state === "guest") {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
        >
          Login
        </Link>

        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-110 transition"
        >
          Join
        </Link>
      </div>
    );
  }

  // 🔐 Logged IN
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/live"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
      >
        Live
      </Link>

      <Link
        href="/dashboard"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
      >
        Dashboard
      </Link>

      <Link
        href="/account"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
      >
        Account
      </Link>

      <button
        onClick={handleLogout}
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
      >
        Logout
      </button>
    </div>
  );
}
