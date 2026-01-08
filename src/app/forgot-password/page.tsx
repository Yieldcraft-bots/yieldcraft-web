"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      // IMPORTANT:
      // This must match your deployed domain for the email reset link to work.
      // Supabase will send a link that returns to this URL.
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "https://yieldcraft.co/login";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setStatus(
        "If an account exists for that email, you’ll receive a password reset link in a moment."
      );
    } catch (err: any) {
      setStatus(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#040914] text-white">
      {/* Background (matches your site) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute -bottom-48 right-[-240px] h-[620px] w-[620px] rounded-full bg-yellow-400/10 blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/35 p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Reset password
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Enter your email and we’ll send a secure reset link.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              Secure
            </span>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-white/80">Email</label>
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white outline-none transition focus:border-white/25 focus:bg-white/7"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@domain.com"
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
              className="w-full rounded-xl bg-yellow-400 px-4 py-2.5 font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_14px_55px_rgba(250,204,21,0.18)] transition hover:brightness-110 disabled:opacity-60"
              type="submit"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/login"
                className="text-sm text-white/70 hover:text-white transition"
              >
                ← Back to login
              </Link>

              <Link
                href="/login?mode=signup"
                className="text-sm text-cyan-300/90 hover:text-cyan-200 transition"
              >
                Create account
              </Link>
            </div>

            <p className="pt-3 text-xs text-white/50">
              If you don’t see the email within 2–3 minutes, check spam/promotions.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
