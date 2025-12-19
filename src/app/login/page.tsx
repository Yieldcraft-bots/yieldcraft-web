// src/app/login/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient"; // ✅ FIXED PATH

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {status && (
            <div className="text-sm text-white/80 border border-white/10 rounded-xl p-3">
              {status}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-yellow-400 text-black font-semibold py-2 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Working…" : mode === "signup" ? "Sign Up" : "Log In"}
          </button>

          <button
            type="button"
            onClick={() => setMode(m => (m === "login" ? "signup" : "login"))}
            className="w-full text-sm text-white/70"
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
    <Suspense fallback={<div className="text-white/70">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
