// src/app/account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type BotStatus = "Active" | "Available" | "Locked";
type StepState = "Done" | "Next" | "Pending";

type Entitlements = {
  pulse: boolean;
  recon: boolean;
  atlas: boolean;
  created_at?: string | null;
};

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

  // Plan / bots (real)
  const [entitlements, setEntitlements] = useState<Entitlements>({
    pulse: false,
    recon: false,
    atlas: false,
    created_at: null,
  });
  const [planName, setPlanName] = useState<string>("Starter Plan");

  // Coinbase + Status (REAL checks)
  const [coinbaseConnected, setCoinbaseConnected] = useState<boolean>(false);
  const [coinbaseGreen, setCoinbaseGreen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1) Session
      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;

      if (!mounted) return;

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const u = session.user;
      setEmail(u.email ?? null);
      setCreatedAt(u.created_at ? new Date(u.created_at) : null);

      const verified =
        Boolean((u as any).email_confirmed_at) ||
        Boolean((u as any).confirmed_at) ||
        Boolean((u as any).user_metadata?.email_verified);

      setEmailVerified(verified);

      const accessToken = session.access_token;

      // Safe metadata fallback (won’t override real checks if they succeed)
      const meta: any = (u as any).user_metadata || {};
      const metaPlan =
        typeof meta.plan_name === "string" && meta.plan_name.trim() ? meta.plan_name : "Starter Plan";
      setPlanName(metaPlan);

      // 2) Entitlements (real)
      try {
        const r = await fetch("/api/entitlements", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j = await r.json().catch(() => null);

        if (!mounted) return;

        if (r.ok && j?.ok === true && j?.entitlements) {
          const e = j.entitlements as Entitlements;
          setEntitlements({
            pulse: !!e.pulse,
            recon: !!e.recon,
            atlas: !!e.atlas,
            created_at: e.created_at ?? null,
          });

          // OPTIONAL: set a clearer plan label without needing Stripe wiring
          const anyOn = !!(e.pulse || e.recon || e.atlas);
          setPlanName(anyOn ? "Active Member" : "Starter Plan");
        } else {
          // keep defaults; don’t fail the page
          setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
        }
      } catch {
        // ignore
      }

      // 3) Coinbase status (real)
      let cbConnected = false;
      try {
        const r = await fetch("/api/coinbase/status", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j = await r.json().catch(() => null);

        if (!mounted) return;

        cbConnected = !!(r.ok && j && j.connected === true);
        setCoinbaseConnected(cbConnected);
      } catch {
        if (!mounted) return;
        setCoinbaseConnected(false);
      }

      // 4) Trading status (real) — if Dashboard is green, this will green too
      try {
        const userId = session.user.id;

        const r = await fetch("/api/pulse-trade", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action: "status", user_id: userId }),
        });

        const j = await r.json().catch(() => null);

        if (!mounted) return;

        const ok = !!(r.ok && j && j.ok === true);
        // “Green” here means: Coinbase connected + status endpoint OK
        setCoinbaseGreen(ok && cbConnected);
      } catch {
        if (!mounted) return;
        setCoinbaseGreen(false);
      }

      if (!mounted) return;
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

  // Bot statuses from entitlements (matches Dashboard)
  const pulseStatus: BotStatus = entitlements.pulse ? "Active" : "Locked";
  const reconStatus: BotStatus = entitlements.recon ? "Active" : "Locked";
  const atlasStatus: BotStatus = entitlements.atlas ? "Available" : "Locked";

  const activeCount = [entitlements.pulse, entitlements.recon].filter(Boolean).length;

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
                If something looks wrong (email not arriving, Coinbase not green), it’s almost always permissions,
                a missing key field, or a login token issue. We’ll keep it step-by-step.
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
              <Chip tone={activeCount > 0 ? "good" : "warn"}>{activeCount} Active</Chip>
            </div>

            <div className="mt-6 space-y-4">
              <BotCard
                name="Pulse"
                tag="LIVE READY"
                desc="Core execution bot (spot) with disciplined cadence."
                status={pulseStatus}
              />
              <BotCard
                name="Recon"
                tag="SIGNALS"
                desc="Signal intelligence layer (confidence + regime)."
                status={reconStatus}
              />
              <BotCard
                name="Atlas"
                tag="WEALTH"
                desc="Long-term allocator for steady compounding (DCA)."
                status={atlasStatus}
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
                    <Chip tone={coinbaseConnected ? "good" : "warn"}>
                      {coinbaseConnected ? "Green" : "Not set"}
                    </Chip>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/45">Status</div>
                  <div className="mt-1">
                    <Chip tone={coinbaseGreen ? "good" : "warn"}>
                      {coinbaseGreen ? "Green" : "Needs check"}
                    </Chip>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/45">
                *These are real checks now: Coinbase comes from <span className="text-white/60">/api/coinbase/status</span>{" "}
                and Status comes from <span className="text-white/60">/api/pulse-trade (action=status)</span>.
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
