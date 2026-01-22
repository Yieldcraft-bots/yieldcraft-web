// src/app/quick-start/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Conn = "ok" | "no" | "checking";

type Entitlements = {
  pulse: boolean;
  recon: boolean;
  atlas: boolean;
  created_at?: string | null;
};

function truthy(v: any) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

function StatusPill({
  label,
  state,
  onClick,
}: {
  label: string;
  state: Conn;
  onClick?: () => void;
}) {
  const styles =
    state === "checking"
      ? "bg-slate-800/60 text-slate-200 ring-1 ring-slate-700"
      : state === "ok"
      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
      : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30";

  const dot =
    state === "checking"
      ? "bg-slate-300"
      : state === "ok"
      ? "bg-emerald-400"
      : "bg-rose-400";

  const text = state === "checking" ? "CHECKING" : state === "ok" ? "GREEN" : "RED";

  const Comp: any = onClick ? "button" : "span";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
        styles,
      ].join(" ")}
      title={onClick ? "Click for details" : undefined}
    >
      <span className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}: {text}
    </Comp>
  );
}

function StepCard({
  number,
  title,
  bullets,
  locked,
  primary,
  secondary,
  comfort,
}: {
  number: number;
  title: string;
  bullets: string[];
  locked?: boolean;
  primary: { label: string; href?: string; internalHref?: string; newTab?: boolean };
  secondary?: { label: string; internalHref: string };
  comfort?: { title: string; lines: string[] };
}) {
  return (
    <div
      className={[
        "rounded-3xl border bg-slate-900/40 p-7 transition",
        locked ? "border-slate-800 opacity-60" : "border-slate-800 hover:border-sky-500/25 hover:shadow-[0_0_70px_rgba(56,189,248,0.08)]",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
              locked ? "bg-slate-700 text-slate-200" : "bg-sky-400 text-slate-950",
            ].join(" ")}
          >
            {number}
          </div>

          <div className="min-w-0">
            <h4 className="text-lg font-semibold text-slate-100">{title}</h4>

            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-300/80" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              {primary.internalHref ? (
                <Link
                  href={locked ? "#" : primary.internalHref}
                  aria-disabled={locked}
                  className={[
                    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-lg",
                    locked
                      ? "cursor-not-allowed bg-slate-700 text-slate-300"
                      : "bg-sky-400 text-slate-950 hover:bg-sky-300",
                  ].join(" ")}
                >
                  {primary.label}
                </Link>
              ) : (
                <a
                  href={locked ? undefined : primary.href}
                  target={primary.newTab ? "_blank" : undefined}
                  rel={primary.newTab ? "noopener noreferrer" : undefined}
                  aria-disabled={locked}
                  className={[
                    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-lg",
                    locked
                      ? "cursor-not-allowed bg-slate-700 text-slate-300"
                      : "bg-sky-400 text-slate-950 hover:bg-sky-300",
                  ].join(" ")}
                  onClick={(e) => {
                    if (locked) e.preventDefault();
                  }}
                >
                  {primary.label}
                </a>
              )}

              {secondary ? (
                <Link
                  href={locked ? "#" : secondary.internalHref}
                  aria-disabled={locked}
                  className={[
                    "inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold",
                    locked
                      ? "cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500"
                      : "border-slate-700 bg-slate-950/40 text-slate-100 hover:border-sky-500/50",
                  ].join(" ")}
                >
                  {secondary.label}
                </Link>
              ) : null}

              <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs font-semibold text-slate-200">
                Follow the buttons in order. No guessing.
              </span>
            </div>
          </div>
        </div>
      </div>

      {comfort ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
          <p className="text-sm font-semibold text-slate-100">{comfort.title}</p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
            {comfort.lines.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function QuickStartPage() {
  const [checking, setChecking] = useState(true);

  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [planConn, setPlanConn] = useState<Conn>("checking");
  const [entitlements, setEntitlements] = useState<Entitlements>({
    pulse: false,
    recon: false,
    atlas: false,
    created_at: null,
  });

  const [coinbaseConn, setCoinbaseConn] = useState<Conn>("checking");
  const [coinbaseAlg, setCoinbaseAlg] = useState<string | null>(null);
  const [coinbaseReason, setCoinbaseReason] = useState<string | null>(null);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // Affiliate ref link for "new Coinbase" path (set as env)
  // Example: NEXT_PUBLIC_COINBASE_REF_URL="https://www.coinbase.com/join/YOURCODE"
  const coinbaseRefUrl =
    (process.env.NEXT_PUBLIC_COINBASE_REF_URL || "").trim() || "https://www.coinbase.com/";

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setChecking(true);
      setPlanConn("checking");
      setCoinbaseConn("checking");

      try {
        // 1) Session
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        if (cancelled) return;

        if (!session) {
          setAuthed(false);
          setEmail(null);
          setPlanConn("no");
          setCoinbaseConn("no");
          setChecking(false);
          return;
        }

        setAuthed(true);
        setEmail(session.user?.email ?? null);

        const accessToken = session.access_token;

        // 2) Entitlements (plan)
        try {
          const r = await fetch("/api/entitlements", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          let j: any = null;
          try {
            j = await r.json();
          } catch {
            j = null;
          }

          if (cancelled) return;

          const ok = !!(r.ok && j && j.ok === true && j.entitlements);
          if (ok) {
            setEntitlements({
              pulse: !!j.entitlements.pulse,
              recon: !!j.entitlements.recon,
              atlas: !!j.entitlements.atlas,
              created_at: j.entitlements.created_at ?? null,
            });
            setPlanConn("ok");
          } else {
            setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
            setPlanConn("no");
          }
        } catch {
          if (cancelled) return;
          setEntitlements({ pulse: false, recon: false, atlas: false, created_at: null });
          setPlanConn("no");
        }

        // 3) Coinbase status (user keys)
        try {
          const r = await fetch("/api/coinbase/status", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          let j: any = null;
          try {
            j = await r.json();
          } catch {
            j = null;
          }

          if (cancelled) return;

          const connected = !!(r.ok && j && j.connected === true);
          setCoinbaseConn(connected ? "ok" : "no");
          setCoinbaseAlg(j?.alg ? String(j.alg) : null);
          setCoinbaseReason(j?.reason || j?.error || null);
        } catch {
          if (cancelled) return;
          setCoinbaseConn("no");
          setCoinbaseAlg(null);
          setCoinbaseReason("network_error");
        }

        setChecking(false);
      } catch {
        if (cancelled) return;
        setAuthed(false);
        setEmail(null);
        setPlanConn("no");
        setCoinbaseConn("no");
        setChecking(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // ORDER ENFORCEMENT
  const step0Done = authed === true;
  const step1Done = planConn === "ok" && entitlements.pulse === true; // requires plan that includes Pulse (your core)
  const step2Done = coinbaseConn === "ok";

  // Locks:
  // - You can always sign in (step 0)
  // - You can subscribe after sign-in (step 1)
  // - You should connect Coinbase AFTER plan (step 2+3)
  const lockPlan = !step0Done;
  const lockCoinbase = !step1Done;

  const statusLine = (() => {
    if (checking) return "Checking your setup…";
    if (!authed) return "Start here: sign in (then come back).";
    if (!step1Done) return "Next: activate a plan (then connect Coinbase).";
    if (!step2Done) return "Next: connect Coinbase (API key + private key).";
    return "You’re set: go to Dashboard and confirm all green.";
  })();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {/* HERO */}
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.32em] text-sky-400 uppercase">
            Quick Start (Order-Enforced)
          </p>

          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
            Join → Subscribe → Connect → Confirm{" "}
            <span className="text-sky-300">green lights</span>.
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            This page adapts to your progress. Follow the buttons in order — on mobile or desktop.
          </p>

          {/* STATUS STRIP */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">Your setup status</p>
                <p className="mt-1 text-xs text-slate-400">{statusLine}</p>
                {email ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Signed in as: <span className="text-slate-200">{email}</span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill label="SIGNED IN" state={authed ? "ok" : checking ? "checking" : "no"} />
                <StatusPill label="PLAN ACTIVE" state={planConn} />
                <StatusPill
                  label="COINBASE"
                  state={coinbaseConn}
                  onClick={() => {
                    // simple alert (no new modal system here)
                    const msg =
                      coinbaseConn === "ok"
                        ? `✅ Coinbase connected.\nAlg: ${coinbaseAlg ?? "unknown"}`
                        : `❌ Coinbase not connected.\nReason: ${coinbaseReason ?? "unknown"}\n\nNext: Connect Keys → Verify & Continue.`;
                    alert(msg);
                  }}
                />
              </div>
            </div>

            {isMobile ? (
              <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-100">
                <p className="font-semibold">Mobile note</p>
                <p className="mt-1 opacity-90">
                  Coinbase may open the app and hide API settings. If you get stuck creating the API key,
                  use Desktop Mode in your mobile browser or finish that step on a laptop — then return here to paste.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>Never force trades</Pill>
              <Pill>Direct execution</Pill>
              <Pill>Withdrawals OFF</Pill>
              <Pill>View + Trade only</Pill>
            </div>
          </div>
        </div>

        {/* STEPS (ORDER-ENFORCED) */}
        <div id="steps" className="space-y-6">
          {/* Step 0: Join / Login */}
          <StepCard
            number={0}
            title="Join / Log in to YieldCraft"
            bullets={[
              "Create your YieldCraft login (or sign in)",
              "After login, come right back to Quick Start",
              "This unlocks your plan + secure key storage",
            ]}
            primary={{ label: authed ? "You’re signed in ✅" : "Go to Login", internalHref: "/login" }}
            comfort={{
              title: "Comfort check",
              lines: [
                "If you’re already logged in, this step is complete.",
                "If you got here from a phone, it’s okay — this page will guide you.",
              ],
            }}
          />

          {/* Step 1: Subscribe (locked until logged in) */}
          <StepCard
            number={1}
            title="Subscribe to a plan (required before connecting Coinbase)"
            locked={lockPlan}
            bullets={[
              "Choose a plan that includes Pulse (core engine)",
              "After checkout, return here automatically or reopen Quick Start",
              "Once active, the Connect step unlocks",
            ]}
            primary={{ label: step1Done ? "Plan active ✅" : "Choose a Plan", internalHref: "/pricing" }}
            comfort={{
              title: "Why plan before Coinbase?",
              lines: [
                "It prevents users from doing the hardest step first.",
                "It ensures the user sees the correct onboarding screens and permissions.",
              ],
            }}
          />

          {/* Step 2: Coinbase choice (existing vs new) */}
          <StepCard
            number={2}
            title="Coinbase: existing account or new account?"
            locked={lockCoinbase}
            bullets={[
              "If you already have Coinbase: use that account",
              "If you want a dedicated trading account: create a new Coinbase login (separate email is often simplest)",
              "API key must be View + Trade only (NO withdrawals)",
            ]}
            primary={{
              label: "I already have Coinbase (continue)",
              href: "https://www.coinbase.com/settings/api",
              newTab: true,
            }}
            secondary={{
              label: "Create a new Coinbase account (affiliate link)",
              internalHref: "/coinbase-new",
            }}
            comfort={{
              title: "Rules-of-thumb",
              lines: [
                "Never enable withdrawals on API keys.",
                "If you create a new Coinbase account, use a separate email and follow Coinbase’s account rules.",
              ],
            }}
          />

          {/* Step 3: Create API key (Coinbase) */}
          <StepCard
            number={3}
            title="Create a Coinbase API key (View + Trade only)"
            locked={lockCoinbase}
            bullets={[
              "Open Coinbase API settings",
              "Create an API key with View + Trade only (NO withdrawals)",
              "Copy two values: API key name + private key",
              "If account is brand new: deposit/fund it first",
            ]}
            primary={{
              label: "Open Coinbase API settings",
              href: "https://www.coinbase.com/settings/api",
              newTab: true,
            }}
            comfort={{
              title: "How you know it’s correct",
              lines: [
                "Permissions show View + Trade.",
                "Withdrawals are OFF.",
                "You copied BOTH: API key name + private key.",
              ],
            }}
          />

          {/* Step 4: Paste keys immediately (YieldCraft) */}
          <StepCard
            number={4}
            title="Paste your keys into YieldCraft (immediately after you create them)"
            locked={lockCoinbase}
            bullets={[
              "Open Connect Keys",
              "Paste API key name + private key",
              "Click Verify & Continue",
              "You should see YOUR COINBASE turn GREEN",
            ]}
            primary={{ label: step2Done ? "Coinbase connected ✅" : "Connect Keys", internalHref: "/connect-keys" }}
            comfort={{
              title: "Copy/paste tip",
              lines: [
                "On mobile, use Coinbase copy icons (don’t drag-select).",
                "If it fails, regenerate the key and paste again cleanly.",
              ],
            }}
          />

          {/* Step 5: Confirm green on Dashboard */}
          <StepCard
            number={5}
            title="Go to Dashboard and confirm green lights"
            locked={!step2Done}
            bullets={[
              "Open Dashboard",
              "Confirm: Signed in + Plan active + YOUR COINBASE green",
              "No trade is normal — waiting is part of the system",
            ]}
            primary={{ label: "Go to Dashboard", internalHref: "/dashboard" }}
            comfort={{
              title: "Important",
              lines: [
                "Connection check ≠ trade.",
                "The system won’t force trades just to ‘feel active’.",
              ],
            }}
          />
        </div>

        {/* NEW Coinbase account helper (internal page link target) */}
        <div id="coinbase-new" className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/40 p-7">
          <h3 className="text-xl font-semibold">Creating a new Coinbase account?</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            If you want a dedicated trading login, open Coinbase using the affiliate link below. Use a separate email
            if that keeps things cleaner. Then return here and continue to the API key step.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={coinbaseRefUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-sky-300"
            >
              Open Coinbase (affiliate)
            </a>

            <a
              href="https://www.coinbase.com/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/50"
            >
              Then go to API settings →
            </a>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            To enable the affiliate link, set{" "}
            <span className="font-mono text-slate-300">NEXT_PUBLIC_COINBASE_REF_URL</span> in Vercel env vars.
          </p>
        </div>

        {/* FOOTER */}
        <footer className="mt-12 border-t border-slate-800 bg-slate-950">
          <div className="mx-auto max-w-6xl px-6 py-8 text-center text-[11px] text-slate-500">
            YieldCraft provides software tools for structured workflows. Not investment advice. Trading involves risk,
            including possible loss of capital. No guarantees of performance.
          </div>
        </footer>
      </div>
    </main>
  );
}
