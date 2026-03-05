"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toFixed(2)}`;
}

function pct(n: any, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "gray";
}) {
  const cls = useMemo(() => {
    switch (tone) {
      case "green":
        return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
      case "yellow":
        return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
      case "red":
        return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30";
      default:
        return "bg-white/5 text-white/70 ring-1 ring-white/10";
    }
  }, [tone]);

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {sub ? <div className="mt-2 text-xs text-white/45">{sub}</div> : null}
    </div>
  );
}

export default function Admin() {
  const router = useRouter();

  const [pulse, setPulse] = useState<any>(null);
  const [inst, setInst] = useState<any>(null);
  const [ts, setTs] = useState(Date.now());

  useEffect(() => {
    async function checkAdmin() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user || user.id !== ADMIN_USER_ID) {
        router.replace("/dashboard");
      }
    }

    checkAdmin();
  }, [router]);

  async function refreshAll() {
    try {
      const p = await fetch("/api/pulse-stats", { cache: "no-store" });
      const pJson = await p.json();
      setPulse(pJson);
    } catch {}

    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;

      if (token) {
        const r = await fetch("/api/admin/institutional-snapshot", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const j = await r.json();
        setInst(j);
      }
    } catch {}

    setTs(Date.now());
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30000);
    return () => clearInterval(id);
  }, []);

  const pStats = pulse?.stats;

  const netTone =
    pStats?.netPnL > 0 ? "green" : pStats?.netPnL < 0 ? "red" : "gray";

  const instData = inst?.institutional?.data;
  const cfSnap = inst?.corefund?.snapshot;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">

        <div className="flex items-end justify-between">

          <div>
            <div className="text-xs text-white/50">ADMIN</div>
            <h1 className="text-3xl font-semibold">Mission Control</h1>
          </div>

          <div className="flex gap-2">

            <TonePill label="LIVE EXECUTION" tone="green" />

            <TonePill
              label={`NET PNL ${pStats ? money(pStats.netPnL) : "—"}`}
              tone={netTone}
            />

            <button
              onClick={refreshAll}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/admin/investor")}
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm"
            >
              Investor
            </button>

          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          <section className="rounded-3xl bg-white/5 p-6">

            <h2 className="text-lg font-semibold">Pulse</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">

              <Stat
                label="Trades"
                value={pStats ? String(pStats.trades) : "—"}
              />

              <Stat
                label="Win Rate"
                value={
                  pStats?.winRate
                    ? `${Math.round(pStats.winRate * 100)}%`
                    : "—"
                }
              />

              <Stat
                label="Net PNL"
                value={pStats ? money(pStats.netPnL) : "—"}
              />

            </div>

          </section>

          <section className="rounded-3xl bg-white/5 p-6">

            <h2 className="text-lg font-semibold">Platform</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">

              <Stat
                label="Users"
                value={instData ? String(instData.total_users_30d) : "—"}
              />

              <Stat
                label="Trades"
                value={instData ? String(instData.total_trades_30d) : "—"}
              />

              <Stat
                label="Volume"
                value={instData ? money(instData.total_volume_usd_30d) : "—"}
              />

            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <Stat
                label="CoreFund Peak"
                value={cfSnap ? money(cfSnap.peak_equity_usd) : "—"}
              />

              <Stat
                label="CoreFund Equity"
                value={cfSnap ? money(cfSnap.last_equity_usd) : "—"}
                sub={
                  cfSnap?.dd_pct_portfolio
                    ? `DD ${pct(cfSnap.dd_pct_portfolio)}`
                    : undefined
                }
              />

            </div>

          </section>

        </div>

      </div>
    </main>
  );
}