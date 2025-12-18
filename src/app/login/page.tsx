// src/app/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signup" | "login";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const initialMode = useMemo<Mode>(() => {
    const m = (params.get("mode") || "").toLowerCase();
    return m === "signup" ? "signup" : "login";
  }, [params]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce to dashboard
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) router.replace("/dashboard");
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    setLoading(true);

    try {
      if (!email || !password) {
        setStatus("Please enter email + password.");
        return;
      }

      if (mode === "signup") {
        // Email/password signup
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // optional: where to land after email confirmation
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;

        setStatus(
          "✅ Check your email to confirm your account. After confirming, come back and log in."
        );
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setStatus("✅ Logged in. Redirecting...");
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setStatus(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-6 shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">
            {mode === "signup" ? "Create your account" : "Log in"}
          </h1>
          <p className="mt-1 text-sm text-white/70">
            {mode === "signup"
              ? "Save your spot. You don’t need to subscribe yet."
              : "Access your dashboard once you're signed in."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-white/80">Email</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-yellow-400/60"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/80">Password</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-yellow-400/60"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-xs text-white/50">
              Tip: use something you’ll remember (we’ll add reset later).
            </p>
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-60"
            type="submit"
          >
            {loading
              ? "Working..."
              : mode === "signup"
              ? "Create account"
              : "Log in"}
          </button>

          {status && (
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
              {status}
            </div>
          )}
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <button
            className="text-white/70 hover:text-white underline"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            type="button"
          >
            {mode === "signup"
              ? "Already have an account? Log in"
              : "New here? Create an account"}
          </button>

          <button
            className="text-white/50 hover:text-white/70"
            onClick={() => router.push("/pricing")}
            type="button"
          >
            View pricing →
          </button>
        </div>

        <div className="mt-6 text-xs text-white/40">
          YieldCraft is software, not financial advice. Trading involves risk.
        </div>
      </div>
    </div>
  );
}
