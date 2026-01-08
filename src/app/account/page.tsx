// src/app/account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type BotStatus = "Active" | "Available" | "Locked";
type StepState = "Done" | "Next" | "Pending";

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}) {
  const styles =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
        : tone === "bad"
          ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
          : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        styles,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}) {
  const styles =
    tone === "good"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
        : tone === "bad"
          ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
          : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        styles,
        className
      )}
    >
      {children}
    </span>
  );
}

function SoftButton({
  children,
  onClick,
  href,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "neutral" | "danger" | "gold";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/10";
  const styles =
    variant === "danger"
      ? "border border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
      : variant === "gold"
        ? "border border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
        : "border border-white/10 bg-white/5 text-white/85 hover:bg-white/10";

  if (href) {
    return (
      <Link href={href} className={cx(base, styles, className)}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cx(base, styles, className)} type="button">
      {children}
    </button>
  );
}

function StepRow({
  title,
  desc,
  state,
  ctaLabel,
  onCta,
}: {
  title: string;
  desc: string;
  state: StepState;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const pill =
    state === "Done" ? (
      <Chip tone="good">Done</Chip>
    ) : state === "Next" ? (
      <Chip tone="warn">Next</Chip>
    ) : (
      <Chip>Pending</Chip>
    );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white font-semibold">{title}</div>
          <div className="mt-1 text-sm text-white/65">{desc}</div>
        </div>
        {pill}
      </div>

      {ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition"
        >
          {ctaLabel}
          <span className="text-white/45">→</span>
        </button>
      ) : null}
    </div>
  );
}

function BotCard({
  name,
  tag,
  desc,
  status,
}: {
  name: string;
  tag: string;
  desc: string;
  status: BotStatus;
}) {
  const tone = status === "Active" ? "good" : status === "Available" ? "warn" : "neutral";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-white font-semibold">{name}</div>
          <Chip tone={tone}>{tag}</Chip>
        </div>
        <Chip tone={tone}>{status}</Chip>
      </div>
      <div className="mt-2 text-sm text-white/65">{desc}</div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  // These are optional “upgrade hooks” you can later wire to real data.
  const [planName, setPlanName] = useState<string>("Starter Plan");
  const [coinbaseConnected, setCoinbaseConnected] = useState<boolean>(false);
  const [coinbaseGreen, setCoinbaseGreen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data?.user) {
        router.push("/login");
        return;
      }

      const u = data.user;
      setEmail(u.email ?? null);
      setCreatedAt(u.created_at ? new Date(u.created_at) : null);

      // Supabase user objects may have different fields depending on setup; handle safely.
      const verified =
        Boolean((u as any).email_confirmed_at) ||
        Boolean((u as any).confirmed_at) ||
        Boolean((u as any).user_metadata?.email_verified);

      setEmailVerified(verified);

      // Optional metadata-driven UI (safe fallbacks)
      const meta: any = (u as any).user_metadata || {};
      const plan = typeof meta.plan_name === "string" && meta.plan_name.trim() ? meta.plan_name : "Starter Plan";
      setPlanName(plan);

      const cbConnected = Boolean(meta.coinbase_connected) || Boolean(meta.coinbase_keys_saved);
      setCoinbaseConnected(cbConnected);

      // “Green” means your app’s status checks are passing (wire later). For now use metadata if present.
      const cbGreen = Boolean(meta.coinbase_green) || Boolean(meta.coinbase_status_ok);
      setCoinbaseGreen(cbGreen);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const onboarding = useMemo(() => {
    const step1: StepState = emailVerified ? "Done" : "Next";
    const step2: StepState = coinbaseConnected ? "Done" : emailVerified ? "Next" : "Pending";
    const step3: StepState = coinbaseGreen ? "Done" : coinbaseConnected ? "Next" : "Pending";
    return { step1, step2, step3 };
  }, [emailVerified, coinbaseConnected, coinbaseGreen]);

  const accountStateTone = emailVerified ? "good" : "warn";
  const accountStateLabel = emailVerified ? "Secure" : "Action needed";

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function goConnectKeys() {
    router.push("/connect-keys");
  }

  function goDashboard() {
    router.push("/dashboard");
  }

  function goForgotPassword() {
    // You already built /forgot-password — use it as the safe reset path.
    const q = email ? `?email=${encodeURIComponent(email)}` : "";
    router.push(`/forgot-password${q}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/70">
        Loading account…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white">Account</h1>
              <Badge tone={accountStateTone}>{accountStateLabel}</Badge>
              <Chip>{planName}</Chip>
            </div>

            <p className="mt-2 text-white/65">
              Your control center for onboarding, subscriptions, and safety.
              <span className="ml-2 text-white/40">
                Funds remain on your exchange — YieldCraft never takes custody.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <SoftButton onClick={goDashboard}>Open Dashboard</SoftButton>
            <SoftButton onClick={signOut} variant="danger">
              Sign out
            </SoftButton>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Account Overview */}
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white text-lg font-semibold">Account Overview</div>
                <div className="mt-1 text-sm text-white/60">Identity, verification, and membership.</div>
              </div>
              <Chip tone={emailVerified ? "good" : "warn"}>{emailVerified ? "Email Verified" : "Verify Email"}</Chip>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Logged in as</div>
              <div className="mt-1 text-white text-lg font-semibold break-all">{email ?? "—"}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wider text-white/45">Member since</div>
                <div className="mt-1 text-white font-semibold">{fmtDate(createdAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wider text-white/45">Status</div>
                <div className="mt-1">
                  <Chip tone="good">Active</Chip>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-white font-semibold">Security</div>
              <div className="mt-1 text-sm text-white/60">Account recovery & best practices.</div>

              <button
                type="button"
                onClick={goForgotPassword}
                className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-black hover:brightness-110 transition"
              >
                Reset password
              </button>

              <div className="mt-4 text-xs text-white/50">
                Tip: use a strong password and enable 2FA on your email provider.
              </div>
            </div>
          </div>

          {/* Middle: Onboarding Checklist */}
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white text-lg font-semibold">Onboarding Checklist</div>
                <div className="mt-1 text-sm text-white/60">Three steps to a clean, green setup.</div>
              </div>
              <Chip>Guided</Chip>
            </div>

            <div className="mt-6 space-y-4">
              <StepRow
                title="Verify your email"
                desc="Required for password resets and security alerts."
                state={onboarding.step1}
                ctaLabel={!emailVerified ? "Resend verification (in app)" : undefined}
                onCta={
                  !emailVerified
                    ? async () => {
                        if (!email) return;
                        // This sends a new sign-in link if you use magic links OR can be replaced later with a dedicated verification resend flow.
                        await supabase.auth.resend({ type: "signup", email });
                        alert("Verification email requested. Check inbox/spam.");
                      }
                    : undefined
                }
              />

              <StepRow
                title="Connect Coinbase"
                desc="Unlock live status checks and API onboarding."
                state={onboarding.step2}
                ctaLabel="Go to Connect Keys"
                onCta={goConnectKeys}
              />

              <StepRow
                title='Confirm “Your Coinbase” is green'
                desc="We’ll guide users to a clean preflight state (no red flags)."
                state={onboarding.step3}
                ctaLabel="Open Dashboard"
                onCta={goDashboard}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white font-semibold">Support</div>
                <Chip tone="warn">Fast help</Chip>
              </div>
              <div className="mt-2 text-sm text-white/60">
                If something looks wrong (email not arriving, Coinbase not green), it’s almost always DNS/SMTP,
                permissions, or one missing key field. We’ll keep it step-by-step.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <SoftButton href="/forgot-password" variant="neutral" className="text-white/85">
                  Reset link
                </SoftButton>
                <SoftButton href="/connect-keys" variant="neutral" className="text-white/85">
                  Reconnect keys
                </SoftButton>
                <SoftButton href="/pricing" variant="gold">
                  See plans
                </SoftButton>
              </div>
            </div>
          </div>

          {/* Right: Subscribed Bots */}
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white text-lg font-semibold">Subscribed Bots</div>
                <div className="mt-1 text-sm text-white/60">Your current suite and availability.</div>
              </div>
              <Chip tone="good">2 Active</Chip>
            </div>

            <div className="mt-6 space-y-4">
              <BotCard
                name="Pulse"
                tag="LIVE READY"
                desc="Core execution bot (spot) with disciplined cadence."
                status="Active"
              />
              <BotCard
                name="Recon"
                tag="SIGNALS"
                desc="Signal intelligence layer (confidence + regime)."
                status="Active"
              />
              <BotCard
                name="Atlas"
                tag="WEALTH"
                desc="Long-term allocator for steady compounding (DCA)."
                status="Available"
              />
              <BotCard
                name="Ignition"
                tag="PRO+"
                desc="Momentum burst module (risk-aware)."
                status="Locked"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-white font-semibold">Account Health</div>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/45">Email</div>
                  <div className="mt-1">
                    <Chip tone={emailVerified ? "good" : "warn"}>{emailVerified ? "Verified" : "Pending"}</Chip>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/45">Coinbase</div>
                  <div className="mt-1">
                    <Chip tone={coinbaseConnected ? "good" : "warn"}>{coinbaseConnected ? "Connected" : "Not set"}</Chip>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/45">Status</div>
                  <div className="mt-1">
                    <Chip tone={coinbaseGreen ? "good" : "warn"}>{coinbaseGreen ? "Green" : "Needs check"}</Chip>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/45">
                *Coinbase “Green” will reflect real preflight checks once we wire the status endpoint.
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-xs text-white/40">
          YieldCraft is a decision-support and execution tooling platform. All trading involves risk; you control keys and
          permissions.
        </div>
      </div>
    </div>
  );
}
