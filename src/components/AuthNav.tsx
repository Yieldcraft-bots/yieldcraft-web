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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data?.session) {
        setState("authed");

        // check admin flag
        const userId = data.session.user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", userId)
          .single();

        if (profile?.is_admin) {
          setIsAdmin(true);
        }
      } else {
        setState("guest");
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return;

      if (session) {
        setState("authed");

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", session.user.id)
          .single();

        setIsAdmin(profile?.is_admin || false);
      } else {
        setState("guest");
        setIsAdmin(false);
      }
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

  if (state === "loading") {
    return <span className="text-sm text-white/50">…</span>;
  }

  // Logged OUT
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

  // Logged IN
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

      {isAdmin && (
        <Link
          href="/admin/platform"
          className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-yellow-400/20 transition"
        >
          Admin
        </Link>
      )}

      <button
        onClick={handleLogout}
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
      >
        Logout
      </button>
    </div>
  );
}