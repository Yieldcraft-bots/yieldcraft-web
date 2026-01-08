"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setEmail(data.user.email);
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/70">
        Loading account…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-semibold text-white">
          Account
        </h1>

        <p className="mt-2 text-white/70 text-sm">
          Secure account overview
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Logged in as
          </div>
          <div className="mt-1 text-white font-medium">
            {email}
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-6 w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-400 font-semibold hover:bg-red-500/20 transition"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
