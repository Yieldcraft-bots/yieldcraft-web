"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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

  // Forgot-password inline UI
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    // When switching modes, keep it clean
    setStatus(null);
    setShowReset(false);
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus("✅ Check your email to confirm your account.");
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

  async function sendResetEmail() {
    setStatus(null);

    const target = (resetEmail || email).trim();
    if (!target) {
      setStatus("Please enter your email first.");
      return;
    }

    setLoading(true);
    try {
      // IMPORTANT: This is where the reset link will send them back to your app
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "https://yieldcraft.co/reset-password";

      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo,
      });

      if (error) throw error;

      setStatus(
        "✅ Password reset email sent. Check your inbox (and spam) for the link."
      );
      setShowReset(false);
    } catch (err: any) {
      setStatus(err?.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {mode === "signup"
            ? "Sign up to access your YieldCraft dashboard."
            : "Log in to continue to YieldCraft."}
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

          {/* Forgot password (login only) */}
          {mode === "login" && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowReset((v) => !v);
                  setResetEmail(email);
                  setStatus(null);
                }}
                className="text-xs text-white/60 hover:text-white underline"
              >
                Forgot password?
              </button>

              <span className="text-xs text-white/40">
                Resets are automated
              </span>
            </div>
          )}

          {/* Inline reset box */}
          {mode === "login" && showReset && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-white">
                Reset your password
              </div>
              <div className="text-xs text-white/60">
                We’ll email you a secure link to set a new password.
              </div>

              <input
                className="w-full rounded-xl bg-black/20 border border-white/10 px-4 py-2 text-white outline-none focus:border-white/30"
                type="email"
                placeholder="Email for reset link"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
              />

              <button
                type="button"
                disabled={loading}
                onClick={sendResetEmail}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </div>
          )}

          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              {status}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-yellow-400 text-black font-semibold px-4 py-2 disabled:opacity-60 hover:bg-yellow-300 transition"
            type="submit"
          >
            {loading ? "Working..." : mode === "signup" ? "Sign Up" : "Log In"}
          </button>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="w-full text-sm text-white/70 hover:text-white transition"
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
