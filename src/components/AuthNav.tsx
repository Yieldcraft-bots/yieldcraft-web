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
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setState(data?.session ? "authed" : "guest");
      } catch {
        if (!mounted) return;
        setState("guest");
      }
    }

    init();

    // Keep nav in sync if session changes (login/logout in another tab)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(session ? "authed" : "guest");
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // If you're on an authed page, get them out cleanly.
      if (
        pathname?.startsWith("/dashboard") ||
        pathname?.startsWith("/admin") ||
        pathname?.startsWith("/live")
      ) {
        router.replace("/login");
      } else {
        router.push("/");
      }
      router.refresh();
    }
  };

  // Prevent layout jump while checking
  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-white/30" />
        <span className="text-sm text-white/60">…</span>
      </span>
    );
  }

  // Logged OUT
  if (state === "guest") {
    return (
      <div className="flex items-center gap-2">
        {/* Login = calm secondary */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:border-white/25"
        >
          Login
        </Link>

        {/* Join = primary (SIGNUP) */}
        <Link
          href="/login?mode=signup"
          className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_12px_40px_rgba(250,204,21,0.22)] transition hover:brightness-110"
        >
          Join
        </Link>
      </div>
    );
  }

  // Logged IN
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/live"
        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        title="Live Trading Snapshot"
      >
        Live
      </Link>

      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
      >
        Dashboard
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        title="Sign out"
      >
        Logout
      </button>
    </div>
  );
}
