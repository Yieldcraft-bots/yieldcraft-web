// src/app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_USER_ID = "295165f4-df46-403f-8727-80408d6a2578";

type PulseStatsResp =
  | {
      ok: true;
      status: "PULSE_STATS_READY";
      dayStart: string;
      table: string;
      counts: { rows: number };
      stats: {
        trades: number;
        sells: number;
        wins: number;
        winRate: number | null;
        grossPnL: number;
        totalFees: number;
        netPnL: number;
      };
    }
  | { ok: boolean; status: string; error?: string; [k: string]: any };

type InstSnapshotResp =
  | {
      ok: true;
      as_of?: string;
      institutional?: { ok: boolean; error?: string | null; data?: any };
      corefund?: {
        snapshot?: {
          as_of?: string;
          peak_equity_usd?: number;
          last_equity_usd?: number;
          total_trades?: number;
          win_rate_pct?: number;
          avg_entry_bps?: number;
          avg_exit_bps?: number;
          avg_hold_minutes?: number;
          dd_pct_portfolio?: number;
          total_volume_usd_30d?: number;
        };
        trades?: Array<any>;
        trades_source?: string;
      };
    }
  | { ok: boolean; status?: string; error?: string; [k: string]: any };

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
function num(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString();
}
function fmtDate(s: any) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString();
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

  const [pulse, setPulse] = useState<PulseStatsResp | null>(null);
  const [inst, setInst] = useState<InstSnapshotResp | null>(null);

  const [errPulse, setErrPulse] = useState<string | null>(null);
  const [errInst, setErrInst] = useState<string | null>(null);

  const [ts, setTs] = useState<number>(Date.now());

  // 🔒 ADMIN LOCK (only you)
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

  async function loadPulse() {
    try {
      setErrPulse(null);
      const r = await fetch("/api/pulse-stats", { cache: "no-store" });
      const j = (await r.json()) as PulseStatsResp;
      setPulse(j);
    } catch (e: any) {
      setErrPulse(e?.message || String(e));
    }
  }

  async function loadInst() {
    try {
      setErrInst(null);

      // NOTE: if your /api/admin/institutional-snapshot currently requires x-cron-secret,
      // this will still pass it IF you have NEXT_PUBLIC_CRON_SECRET set.
      const headers: Record<string, string> = {};
      const maybeSecret = (process as any)?.env?.NEXT_PUBLIC_CRON_SECRET;
      if (maybeSecret) headers["x-cron-secret"] = String(maybeSecret);

      const r = await fetch("/api/admin/institutional-snapshot", {
        cache: "no-store",
        headers,
      });
      const j = (await r.json()) as InstSnapshotResp;
      setInst(j);
    } catch (e: any) {
      setErrInst(e?.message || String(e));
    }
  }

  async function refreshAll() {
    await Promise.all([loadPulse(), loadInst()]);
    setTs(Date.now());
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseReady = pulse && (pulse as any).status === "PULSE_STATS_READY";
  const pStats = pulseReady ? (pulse as any).stats : null;

  const netTone: "green" | "yellow" | "red" | "gray" = useMemo(() => {
    if (!pStats) return "gray";
    if (pStats.netPnL > 0) return "green";
    if (pStats.netPnL < 0) return "red";
    return "yellow";
  }, [pStats]);

  const instOk = !!inst && (inst as any).ok === true;
  const instData = instOk ? (inst as any).institutional?.data : null;
  const cf = instOk ? (inst as any).corefund : null;
  const cfSnap = cf?.snapshot || null;
  const cfTrades: any[] = Array.isArray(cf?.trades) ? cf.trades : [];

  const ddTone: "green" | "yellow" | "red" | "gray" = useMemo(() => {
    const dd = Number(cfSnap?.dd_pct_portfolio);
    if (!Number.isFinite(dd)) return "gray";
    if (dd <= 2) return "green";
    if (dd <= 5) return "yellow";
    return "red";
  }, [cfSnap?.dd_pct_portfolio]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs text-white/50">ADMIN</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Mission Control
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Two-panel view: <span className="text-white/80">Pulse Today</span> +{" "}
              <span className="text-white/80">Platform & CoreFund</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TonePill label="LIVE EXECUTION: ON" tone="green" />
            <TonePill label="AUTO MODE: ON" tone="green" />
            <TonePill
              label={`NET P&L TODAY: ${pStats ? money(pStats.netPnL) : "—"}`}
              tone={netTone}
            />
            <TonePill
              label={`DD: ${cfSnap?.dd_pct_portfolio != null ? pct(cfSnap.dd_pct_portfolio, 2) : "—"}`}
              tone={ddTone}
            />
            <button
              onClick={refreshAll}
              className="ml-1 rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* TWO SEXY BOXES */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* LEFT BOX: Pulse */}
          <section className="rounded-3xl bg-white/4 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pulse — Today</h2>
                <div className="mt-1 text-xs text-white/45">
                  Source: <span className="text-white/70">/api/pulse-stats</span>{" "}
                  • Day start (CT):{" "}
                  <span className="text-white/70">
                    {pulseReady ? (pulse as any).dayStart : "—"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-white/45">
                Last refresh:{" "}
                <span className="text-white/70">
                  {new Date(ts).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat label="Trades Today" value={pStats ? String(pStats.trades) : "—"} />
              <Stat
                label="Win Rate"
                value={
                  pStats && pStats.winRate != null
                    ? `${Math.round(pStats.winRate * 100)}%`
                    : "—"
                }
                sub={`Wins: ${pStats ? pStats.wins : "—"} • Sells: ${
                  pStats ? pStats.sells : "—"
                }`}
              />
              <Stat
                label="Net P&L Today"
                value={pStats ? money(pStats.netPnL) : "—"}
                sub={`Fees: ${pStats ? money(pStats.totalFees) : "—"}`}
              />
            </div>

            {!pulseReady && pulse ? (
              <pre className="mt-5 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-white/70 ring-1 ring-white/10">
{JSON.stringify(pulse, null, 2)}
              </pre>
            ) : null}

            {errPulse ? (
              <div className="mt-5 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
                {errPulse}
              </div>
            ) : null}
          </section>

          {/* RIGHT BOX: Platform + CoreFund */}
          <section className="rounded-3xl bg-white/4 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Platform + CoreFund</h2>
                <div className="mt-1 text-xs text-white/45">
                  Source:{" "}
                  <span className="text-white/70">
                    /api/admin/institutional-snapshot
                  </span>{" "}
                  • As of:{" "}
                  <span className="text-white/70">
                    {instOk ? fmtDate((inst as any).as_of) : "—"}
                  </span>
                </div>
              </div>

              <TonePill
                label={instOk ? "SNAPSHOT: OK" : "SNAPSHOT: —"}
                tone={instOk ? "green" : "gray"}
              />
            </div>

            {/* Metrics row */}
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat
                label="Users (30d)"
                value={instData ? String(instData.total_users_30d) : "—"}
                sub={`Active 24h: ${instData ? instData.active_users_24h : "—"}`}
              />
              <Stat
                label="Trades (30d)"
                value={instData ? String(instData.total_trades_30d) : "—"}
                sub={`24h: ${instData ? instData.trades_24h : "—"}`}
              />
              <Stat
                label="Volume (30d)"
                value={instData ? money(instData.total_volume_usd_30d) : "—"}
                sub={`Avg trade: ${instData ? money(instData.avg_trade_usd_30d) : "—"}`}
              />
            </div>

            {/* CoreFund row */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat
                label="CoreFund Peak Equity"
                value={cfSnap ? money(cfSnap.peak_equity_usd) : "—"}
                sub={cfSnap?.as_of ? `As of: ${fmtDate(cfSnap.as_of)}` : undefined}
              />
              <Stat
                label="CoreFund Current Equity"
                value={cfSnap ? money(cfSnap.last_equity_usd) : "—"}
                sub={
                  cfSnap?.dd_pct_portfolio != null
                    ? `Drawdown: ${pct(cfSnap.dd_pct_portfolio, 2)}`
                    : undefined
                }
              />
              <Stat
                label="CoreFund Trades"
                value={cfTrades ? String(cfTrades.length) : "—"}
                sub={cf?.trades_source ? `Source: ${cf.trades_source}` : undefined}
              />
            </div>

            {/* Recent Trades table */}
            <div className="mt-5 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">Recent Trades</div>
                <div className="text-xs text-white/45">
                  Showing {Math.min(10, cfTrades.length)} / {cfTrades.length}
                </div>
              </div>

              {cfTrades.length === 0 ? (
                <div className="text-sm text-white/50">No trades returned yet.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-white/50">
                      <tr className="border-b border-white/10">
                        <th className="py-2 pr-3">Time</th>
                        <th className="py-2 pr-3">Symbol</th>
                        <th className="py-2 pr-3">Side</th>
                        <th className="py-2 pr-3">Quote</th>
                        <th className="py-2 pr-3">Price</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/80">
                      {cfTrades.slice(0, 10).map((t, i) => (
                        <tr key={t?.id ?? i} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-white/60">
                            {fmtDate(t?.created_at)}
                          </td>
                          <td className="py-2 pr-3">{t?.symbol || t?.product_id || "—"}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${
                                String(t?.side || "").toUpperCase() === "BUY"
                                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"
                                  : "bg-rose-500/10 text-rose-200 ring-rose-500/25"
                              }`}
                            >
                              {String(t?.side || "—").toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 pr-3">{t?.quote_size ? money(t.quote_size) : "—"}</td>
                          <td className="py-2 pr-3">{t?.price ? `$${Number(t.price).toLocaleString()}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!instOk && inst ? (
              <pre className="mt-5 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-white/70 ring-1 ring-white/10">
{JSON.stringify(inst, null, 2)}
              </pre>
            ) : null}

            {errInst ? (
              <div className="mt-5 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
                {errInst}
              </div>
            ) : null}
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-xs text-white/35">
          Admin page is locked to your Supabase user id. If anyone hits /admin, they get bounced to /dashboard.
        </div>
      </div>
    </main>
  );
}