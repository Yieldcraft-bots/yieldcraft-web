// src/components/AuthNav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setSignedIn(!!data?.session);
      } catch {
        if (!alive) return;
        setSignedIn(false);
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function onLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  // Don’t flash the wrong buttons while loading
  if (loading) return null;

  if (!signedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Login
        </Link>
        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95"
        >
          Join
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {pathname !== "/dashboard" && (
        <Link
          href="/dashboard"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
        >
          Dashboard
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
      >
        Logout
      </button>
    </div>
  );
}
