"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Supabase password recovery tokens typically arrive in the URL hash.
  // Example: /reset-password#access_token=...&refresh_token=...&type=recovery
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // If tokens are present, Supabase JS can pick them up and establish a session.
        // getSession will be non-null after the client processes the hash.
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          setStatus(error.message);
          setSessionOk(false);
        } else {
          setSessionOk(!!data.session);
          setStatus(
            data.session
              ? "Session verified. Set your new password below."
              : "Missing or expired recovery session. Please request a new reset link."
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setSessionOk(false);
        setStatus(e?.message || "Unable to verify reset session.");
      } finally {
        if (!mounted) return;
        setReady(true);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!sessionOk) {
      setStatus("No active reset session. Please request a new password reset link.");
      return;
    }

    if (pw.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;

      setStatus("Password updated. Redirecting to login…");
      setTimeout(() => router.replace("/login?reset=1"), 900);
    } catch (err: any) {
      setStatus(err?.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#040914] text-white">
      {/* Background */}
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
              <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
              <p className="mt-2 text-sm text-white/70">
                This page completes your password reset securely.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              Secure
            </span>
          </div>

          {!ready ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              Verifying reset session…
            </div>
          ) : (
            <>
              {status && (
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  {status}
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-white/80">New password</label>
                  <input
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white outline-none transition focus:border-white/25 focus:bg-white/7"
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    disabled={!sessionOk}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Confirm password</label>
                  <input
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white outline-none transition focus:border-white/25 focus:bg-white/7"
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    disabled={!sessionOk}
                    required
                  />
                </div>

                <button
                  disabled={loading || !sessionOk}
                  className="w-full rounded-xl bg-yellow-400 px-4 py-2.5 font-semibold text-black shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_14px_55px_rgba(250,204,21,0.18)] transition hover:brightness-110 disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>

                <div className="flex items-center justify-between pt-2">
                  <Link href="/login" className="text-sm text-white/70 hover:text-white transition">
                    ← Back to login
                  </Link>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-cyan-300/90 hover:text-cyan-200 transition"
                  >
                    Request new link
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
