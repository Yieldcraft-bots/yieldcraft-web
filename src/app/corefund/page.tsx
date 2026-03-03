// src/app/corefund/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Conn = "ok" | "no" | "checking";

type CoreFundOk = {
  ok: true;
  runId?: string;
  since?: string;
  symbol?: string;
  exchange?: string;

  rows_scanned?: number;
  rows_usable?: number;
  limit?: number;

  total_trades?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;

  avg_win_bps?: number;
  avg_loss_bps?: number;

  fees_usd?: number;
  net_realized_pnl_usd_gross?: number;
  net_realized_pnl_usd?: number;

  open_position_base?: number;
  open_cost_usd?: number;
  spot_price?: number | null;
  open_avg_price?: number | null;
  current_open_pnl_usd?: number;

  starting_equity_usd?: number;
  running_equity_usd?: number;
  max_drawdown_pct?: number;

  debug?: any;
};

type CoreFundErr = { ok: false; error: string; runId?: string; hint?: string };

function fmtMoney(n: any) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtSignedMoney(n: any) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtPct(n: any) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}
function fmtBps(n: any) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} bps`;
}
function fmtNum(n: any, digits = 8) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function CoreFundPage() {
  const router = useRouter();
  const mountedRef = useRef(true);

  const [conn, setConn] = useState<Conn>("checking");
  const [data, setData] = useState<CoreFundOk | CoreFundErr | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const run = async () => {
    setConn("checking");
    setLastCheck(new Date());

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || null;

    if (!token) {
      setConn("no");
      setData({ ok: false, error: "not_authenticated" });
      router.replace("/login");
      return;
    }

    // last 90 days
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // ✅ CALL THE RIGHT ROUTE
    const url = `/api/corefund/pnl_snapshot_v1?since=${encodeURIComponent(since)}&symbol=BTC-USD&exchange=coinbase`;

    const r = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });

    const j = await r.json().catch(() => null);

    if (r.ok && j?.ok === true) {
      setConn("ok");
      setData(j as CoreFundOk);
    } else {
      setConn("no");
      setData({
        ok: false,
        error: j?.error || `http_${r.status}`,
        runId: j?.runId,
        hint: j?.hint,
      } as CoreFundErr);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ok = data && (data as any).ok === true ? (data as CoreFundOk) : null;
  const err = data && (data as any).ok === false ? (data as CoreFundErr) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Core Fund — Private PnL</h1>
            <p className="mt-1 text-sm text-slate-400">
              Private view. Computed from <span className="font-mono">corefund_trade_logs</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-semibold hover:bg-slate-900/70"
            >
              Back
            </Link>

            <button
              onClick={run}
              className="rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-semibold hover:bg-slate-900/70"
            >
              Re-check
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/35 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Status</p>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold ring-1",
                conn === "ok"
                  ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
                  : conn === "checking"
                  ? "bg-slate-800/60 text-slate-200 ring-slate-700"
                  : "bg-rose-500/15 text-rose-200 ring-rose-500/25",
              ].join(" ")}
            >
              {conn === "ok" ? "GREEN" : conn === "checking" ? "CHECKING" : "RED"}
            </span>
          </div>

          {err ? (
            <div className="mt-4 text-sm text-rose-200">
              <p>Error: {err.error}</p>
              {err.runId ? <p className="mt-1 text-xs text-rose-300/80">runId: {err.runId}</p> : null}
              {err.hint ? <p className="mt-2 text-xs text-slate-400">{err.hint}</p> : null}
            </div>
          ) : null}

          {ok ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs text-slate-400">Realized PnL</p>
                <p className="mt-1 font-mono text-lg">{fmtSignedMoney(ok.net_realized_pnl_usd)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Fees: {fmtMoney(ok.fees_usd)} · Gross: {fmtSignedMoney(ok.net_realized_pnl_usd_gross)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs text-slate-400">Open PnL</p>
                <p className="mt-1 font-mono text-lg">{fmtSignedMoney(ok.current_open_pnl_usd)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Position: {fmtNum(ok.open_position_base, 8)} BTC · Spot: {fmtMoney(ok.spot_price)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs text-slate-400">Trades</p>
                <p className="mt-1 font-mono text-lg">
                  {ok.total_trades ?? 0} ({ok.wins ?? 0}/{ok.losses ?? 0})
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Win rate: {fmtPct(ok.win_rate)} · Avg win: {fmtBps(ok.avg_win_bps)} · Avg loss:{" "}
                  {fmtBps(ok.avg_loss_bps)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs text-slate-400">Equity / Drawdown</p>
                <p className="mt-1 font-mono text-lg">{fmtMoney(ok.running_equity_usd)}</p>
                <p className="mt-2 text-xs text-slate-500">Max DD: {fmtPct(ok.max_drawdown_pct)}</p>
              </div>

              <div className="sm:col-span-2 text-xs text-slate-500">
                Since: <span className="text-slate-300">{ok.since ?? "—"}</span> · runId:{" "}
                <span className="text-slate-300">{ok.runId ?? "—"}</span>
                {lastCheck ? (
                  <>
                    {" "}
                    · last check: <span className="text-slate-300">{lastCheck.toLocaleString()}</span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}