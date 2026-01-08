// src/app/account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PlanTier = "Free" | "Starter" | "Pro" | "Elite";

type Bot = {
  name: string;
  description: string;
  status: "Active" | "Available" | "Locked";
  badge: string;
};

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : tone === "warn"
      ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"
      : tone === "danger"
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : "border-white/10 bg-white/5 text-white/80";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-white text-base font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-white/60">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="pt-0.5">{right}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function formatDate(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(null);

  // Future: Replace these with real subscription + connection state (safe reads).
  const plan: PlanTier = "Starter";
  const coinbaseConnected = false;

  const bots: Bot[] = useMemo(
    () => [
      {
        name: "Pulse",
        description: "Core execution bot (spot) with disciplined cadence.",
        status: "Active",
        badge: "LIVE READY",
      },
      {
        name: "Recon",
        description: "Signal intelligence layer (confidence + regime).",
        status: "Active",
        badge: "SIGNALS",
      },
      {
        name: "Atlas",
        description: "Long-term allocator for steady compounding (DCA).",
        status: "Available",
        badge: "WEALTH",
      },
      {
        name: "Ignition",
        description: "Momentum burst module (risk-gated).",
        status: "Locked",
        badge: "PRO+",
      },
      {
        name: "Ascend",
        description: "Institutional-style upgrades & paired logic.",
        status: "Locked",
        badge: "ELITE",
      },
    ],
    []
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!data.user) {
        router.push("/login");
        return;
      }

      setEmail(data.user.email ?? null);
      setCreatedAt((data.user as any)?.created_at ?? null);
      // Supabase returns different fields depending on config; handle both.
      setEmailConfirmedAt(
        (data.user as any)?.email_confirmed_at ??
          (data.user as any)?.confirmed_at ??
          null
      );

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const emailVerified = Boolean(emailConfirmedAt);

  const onboarding = [
    {
      title: "Verify your email",
      desc: "Required for password resets and security alerts.",
      done: emailVerified,
      cta: emailVerified ? null : (
        <Link
          href="/login?mode=login"
          className="text-xs text-white/70 hover:text-white underline"
        >
          Resend verification (if needed)
        </Link>
      ),
    },
    {
      title: "Connect Coinbase",
      desc: "Unlock live status checks and API onboarding.",
      done: coinbaseConnected,
      cta: (
        <Link
          href="/connect-keys"
          className="text-xs text-white/70 hover:text-white underline"
        >
          Go to Connect Keys
        </Link>
      ),
    },
    {
      title: "Confirm “Your Coinbase” is green",
      desc: "We’ll guide users to a clean preflight state (no red flags).",
      done: false,
      cta: (
        <Link
          href="/dashboard"
          className="text-xs text-white/70 hover:text-white underline"
        >
          Open Dashboard
        </Link>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/70">
        Loading account…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-32 left-12 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2">
              <h1 className="text-3xl font-semibold text-white">Account</h1>
              <Pill tone="good">Secure</Pill>
              {plan ? <Pill>{plan} Plan</Pill> : null}
            </div>
            <p className="mt-2 text-sm text-white/65">
              Your control center for onboarding, subscriptions, and safety.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              Open Dashboard
            </Link>
            <button
              onClick={logout}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: Overview + Security */}
          <div className="space-y-5 lg:col-span-1">
            <Card
              title="Account Overview"
              subtitle="Identity, verification, and membership."
              right={
                emailVerified ? (
                  <Pill tone="good">Email Verified</Pill>
                ) : (
                  <Pill tone="warn">Verify Email</Pill>
                )
              }
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/50">
                    Logged in as
                  </div>
                  <div className="mt-1 text-white font-medium">
                    {email ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/50">Member since</div>
                    <div className="mt-1 text-sm text-white">
                      {formatDate(createdAt)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/50">Status</div>
                    <div className="mt-1">
                      <Pill tone="good">Active</Pill>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Security"
              subtitle="Account recovery & best practices."
            >
              <div className="space-y-3">
                <Link
                  href="/forgot-password"
                  className="block w-full rounded-xl bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-black hover:bg-yellow-300 transition"
                >
                  Reset password
                </Link>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70 leading-relaxed">
                  Tip: If you don’t receive emails, check spam/promotions.
                  We’re updating all system emails to show <span className="text-white font-medium">YieldCraft</span>{" "}
                  as the sender.
                </div>
              </div>
            </Card>
          </div>

          {/* Middle: Onboarding */}
          <div className="space-y-5 lg:col-span-1">
            <Card
              title="Onboarding Checklist"
              subtitle="Three steps to a clean, green setup."
              right={<Pill tone="neutral">Guided</Pill>}
            >
              <div className="space-y-3">
                {onboarding.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-white/65">
                          {item.desc}
                        </div>
                      </div>
                      {item.done ? (
                        <Pill tone="good">Done</Pill>
                      ) : (
                        <Pill tone="warn">Next</Pill>
                      )}
                    </div>
                    {item.cta ? (
                      <div className="mt-3">{item.cta}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Coinbase Connection"
              subtitle="Status shown here once keys are connected."
              right={
                coinbaseConnected ? (
                  <Pill tone="good">Connected</Pill>
                ) : (
                  <Pill tone="danger">Not Connected</Pill>
                )
              }
            >
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Your Coinbase
                    </div>
                    <div className="mt-1 text-xs text-white/65">
                      We’ll show a green status when your API setup passes preflight.
                    </div>
                  </div>
                  {coinbaseConnected ? (
                    <Pill tone="good">Green</Pill>
                  ) : (
                    <Pill tone="danger">Red</Pill>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/connect-keys"
                    className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-center text-sm text-white hover:bg-white/15 transition"
                  >
                    Connect keys
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-sm text-white/80 hover:bg-white/5 transition"
                  >
                    View status
                  </Link>
                </div>
              </div>

              <div className="mt-3 text-xs text-white/60">
                Note: This page is UI-only. No trading happens from here.
              </div>
            </Card>
          </div>

          {/* Right: Bots + Support */}
          <div className="space-y-5 lg:col-span-1">
            <Card
              title="Subscribed Bots"
              subtitle="Your current suite and availability."
              right={<Pill>{bots.filter((b) => b.status === "Active").length} Active</Pill>}
            >
              <div className="space-y-3">
                {bots.map((b) => (
                  <div
                    key={b.name}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            {b.name}
                          </div>
                          <Pill tone="neutral">{b.badge}</Pill>
                        </div>
                        <div className="mt-1 text-xs text-white/65">
                          {b.description}
                        </div>
                      </div>

                      {b.status === "Active" ? (
                        <Pill tone="good">Active</Pill>
                      ) : b.status === "Available" ? (
                        <Pill tone="warn">Available</Pill>
                      ) : (
                        <Pill tone="neutral">Locked</Pill>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href="/pricing"
                  className="flex-1 rounded-xl bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-black hover:bg-yellow-300 transition"
                >
                  Upgrade plan
                </Link>
                <Link
                  href="/quick-start"
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-sm text-white/80 hover:bg-white/5 transition"
                >
                  Quick Start
                </Link>
              </div>
            </Card>

            <Card
              title="Support & Safety"
              subtitle="Fast answers + guardrails."
            >
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  <div className="font-semibold text-white">Need help?</div>
                  <div className="mt-1 text-xs text-white/65">
                    If anything feels off during onboarding, don’t guess—use the checklist and we’ll get you green.
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <a
                      className="text-xs text-white/70 hover:text-white underline"
                      href="mailto:support@yieldcraft.co"
                    >
                      Email support: support@yieldcraft.co
                    </a>
                    <Link
                      className="text-xs text-white/70 hover:text-white underline"
                      href="/dashboard"
                    >
                      Open Dashboard (Status)
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/65 leading-relaxed">
                  <span className="text-white/80 font-semibold">Safety note:</span>{" "}
                  YieldCraft will never place orders unless trading is explicitly enabled by the user in the trading layer.
                  This page is informational and designed to reduce credential issues and support load.
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-8 text-center text-xs text-white/45">
          YieldCraft • Direct Execution • AI Risk Engines
        </div>
      </div>
    </div>
  );
}
