"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

type StrategyIntelResp =
  | {
      ok: true;
      tradesAnalyzed: number;
      wins: number;
      losses: number;
      avgWinBps: number;
      avgLossBps: number;
      edgePerTradeBps: number;
      entryQualityPct: number;
      exitEfficiencyPct: number;
    }
  | { ok: false; error?: string; [k: string]: any };

type Tone = "green" | "yellow" | "red" | "gray";

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

function bps(n: any, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)} bps`;
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "green":
      return {
        pill: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
        card: "bg-emerald-500/10 ring-1 ring-emerald-500/25",
        value: "text-emerald-300",
        sub: "text-emerald-200/70",
      };
    case "yellow":
      return {
        pill: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
        card: "bg-amber-500/10 ring-1 ring-amber-500/25",
        value: "text-amber-200",
        sub: "text-amber-100/70",
      };
    case "red":
      return {
        pill: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30",
        card: "bg-rose-500/10 ring-1 ring-rose-500/25",
        value: "text-rose-200",
        sub: "text-rose-100/70",
      };
    default:
      return {
        pill: "bg-white/5 text-white/70 ring-1 ring-white/10",
        card: "bg-white/5 ring-1 ring-white/10",
        value: "text-white",
        sub: "text-white/45",
      };
  }
}

function pnlTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  if (n < 0) return "red";
  return "gray";
}

function edgeTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  if (n >= -10) return "yellow";
  return "red";
}

function entryQualityTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  if (n >= -0.5) return "yellow";
  return "red";
}

function exitEfficiencyTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n >= 85) return "green";
  if (n >= 70) return "yellow";
  return "red";
}

function winRateTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n >= 55) return "green";
  if (n >= 40) return "yellow";
  return "red";
}

function drawdownTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n <= 5) return "green";
  if (n <= 10) return "yellow";
  return "red";
}

function avgWinTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n > 0) return "green";
  return "red";
}

function avgLossTone(v: any): Tone {
  const n = Number(v);
  if (!Number.isFinite(n)) return "gray";
  if (n <= 120) return "green";
  if (n <= 170) return "yellow";
  return "red";
}

function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  const cls = useMemo(() => toneClasses(tone).pill, [tone]);

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}
    >
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "gray",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const cls = toneClasses(tone);

  return (
    <div className={`rounded-2xl p-5 ${cls.card}`}>
      <div className="text-xs text-white/60">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${cls.value}`}>
        {value}
      </div>
      {sub ? <div className={`mt-2 text-xs ${cls.sub}`}>{sub}</div> : null}
    </div>
  );
}

export default function Admin() {
  const router = useRouter();

  const [pulse, setPulse] = useState<any>(null);
  const [inst, setInst] = useState<any>(null);
  const [strategyIntel, setStrategyIntel] = useState<StrategyIntelResp | null>(
    null
  );
  const [ts, setTs] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!mounted) return;

      if (!user || user.id !== ADMIN_USER_ID) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    checkAdmin();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function refreshAll() {
    try {
      const p = await fetch("/api/pulse-stats", { cache: "no-store" });
      const pJson = await p.json();
      setPulse(pJson);
    } catch {
      // ignore
    }

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
    } catch {
      // ignore
    }

    try {
      const strategyRes = await fetch("/api/strategy-intelligence", {
        cache: "no-store",
      });
      const strategyJson = await strategyRes.json();
      setStrategyIntel(strategyJson);
    } catch {
      // ignore
    }

    setTs(Date.now());
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pStats = pulse?.stats;
  const instData = inst?.institutional?.data;
  const cfSnap = inst?.corefund?.snapshot;

  const netTone = pnlTone(pStats?.netPnL);
  const topEdgeTone =
    strategyIntel && strategyIntel.ok
      ? edgeTone(strategyIntel.edgePerTradeBps)
      : "gray";

  const winRatePct =
    pStats && pStats.winRate != null ? Number(pStats.winRate) * 100 : null;

  const pulseWinRateTone = winRateTone(winRatePct);
  const coreFundDdTone = drawdownTone(cfSnap?.dd_pct_portfolio);

  const strategyEdgeTone =
    strategyIntel && strategyIntel.ok
      ? edgeTone(strategyIntel.edgePerTradeBps)
      : "gray";

  const strategyEntryTone =
    strategyIntel && strategyIntel.ok
      ? entryQualityTone(strategyIntel.entryQualityPct)
      : "gray";

  const strategyExitTone =
    strategyIntel && strategyIntel.ok
      ? exitEfficiencyTone(strategyIntel.exitEfficiencyPct)
      : "gray";

  const strategyAvgWinTone =
    strategyIntel && strategyIntel.ok
      ? avgWinTone(strategyIntel.avgWinBps)
      : "gray";

  const strategyAvgLossTone =
    strategyIntel && strategyIntel.ok
      ? avgLossTone(strategyIntel.avgLossBps)
      : "gray";

  const lastRefresh = new Date(ts).toLocaleTimeString();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-white/50">ADMIN</div>
            <h1 className="text-3xl font-semibold">Mission Control</h1>
            <div className="mt-1 text-xs text-white/45">
              Last refresh: <span className="text-white/70">{lastRefresh}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TonePill label="LIVE EXECUTION" tone="green" />
            <TonePill
              label={`NET PNL ${pStats ? money(pStats.netPnL) : "—"}`}
              tone={netTone}
            />
            <TonePill
              label={`EDGE ${
                strategyIntel && strategyIntel.ok
                  ? bps(strategyIntel.edgePerTradeBps)
                  : "—"
              }`}
              tone={topEdgeTone}
            />

            <button
              onClick={refreshAll}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-white/15"
            >
              Refresh
            </button>

            <Link
              href="/admin/investor"
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-indigo-500/30"
            >
              Investor
            </Link>

            <Link
              href="/admin/platform"
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm ring-1 ring-white/10 transition hover:bg-indigo-500/30"
            >
              Platform
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="text-lg font-semibold">Pulse</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat
                label="Trades"
                value={pStats ? String(pStats.trades) : "—"}
              />

              <Stat
                label="Win Rate"
                value={
                  pStats && pStats.winRate != null
                    ? `${Math.round(Number(pStats.winRate) * 100)}%`
                    : "—"
                }
                tone={pulseWinRateTone}
              />

              <Stat
                label="Net PNL"
                value={pStats ? money(pStats.netPnL) : "—"}
                tone={netTone}
              />
            </div>
          </section>

          <section className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
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
                  cfSnap?.dd_pct_portfolio != null
                    ? `DD ${pct(cfSnap.dd_pct_portfolio)}`
                    : undefined
                }
                tone={coreFundDdTone}
              />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Strategy Intelligence</h2>
            <TonePill
              label={
                strategyIntel && strategyIntel.ok
                  ? "LEARNING ACTIVE"
                  : "INTEL OFFLINE"
              }
              tone={strategyIntel && strategyIntel.ok ? "green" : "gray"}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Trades Analyzed"
              value={
                strategyIntel && strategyIntel.ok
                  ? String(strategyIntel.tradesAnalyzed)
                  : "—"
              }
            />

            <Stat
              label="Edge / Trade"
              value={
                strategyIntel && strategyIntel.ok
                  ? bps(strategyIntel.edgePerTradeBps)
                  : "—"
              }
              tone={strategyEdgeTone}
            />

            <Stat
              label="Entry Quality"
              value={
                strategyIntel && strategyIntel.ok
                  ? pct(strategyIntel.entryQualityPct)
                  : "—"
              }
              tone={strategyEntryTone}
            />

            <Stat
              label="Exit Efficiency"
              value={
                strategyIntel && strategyIntel.ok
                  ? pct(strategyIntel.exitEfficiencyPct)
                  : "—"
              }
              tone={strategyExitTone}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Wins"
              value={
                strategyIntel && strategyIntel.ok
                  ? String(strategyIntel.wins)
                  : "—"
              }
            />

            <Stat
              label="Losses"
              value={
                strategyIntel && strategyIntel.ok
                  ? String(strategyIntel.losses)
                  : "—"
              }
            />

            <Stat
              label="Avg Win"
              value={
                strategyIntel && strategyIntel.ok
                  ? bps(strategyIntel.avgWinBps)
                  : "—"
              }
              tone={strategyAvgWinTone}
            />

            <Stat
              label="Avg Loss"
              value={
                strategyIntel && strategyIntel.ok
                  ? bps(strategyIntel.avgLossBps)
                  : "—"
              }
              tone={strategyAvgLossTone}
            />
          </div>
        </section>
      </div>
    </main>
  );
}