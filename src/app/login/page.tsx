// src/app/login/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient"; // ✅ correct: from src/app/login -> src/lib

type Mode = "signup" | "login";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const initialMode = useMemo<Mode>(() => {
    const m = (params.get("mode") || "").toLowerCase();
    return m === "signup" ? "signup" : "login";
  }, [params]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus("Check your email to confirm your account.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      router.push("/dashboard");
    } catch (err: any) {
      setStatus(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {mode === "signup"
            ? "Sign up to access your YieldCraft dashboard."
            : "Log in to continue."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/80 mb-1">Email</label>
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white outline-none focus:border-white/30"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-1">Password</label>
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white outline-none focus:border-white/30"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </div>

          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {status}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-yellow-400 text-black font-semibold px-4 py-2 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Working..." : mode === "signup" ? "Sign Up" : "Log In"}
          </button>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="w-full text-sm text-white/70 hover:text-white"
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/70 bg-slate-950">
          Loading…
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
