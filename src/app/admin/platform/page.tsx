"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Resp = {
  ok: boolean;
  as_of?: string;
  institutional?: { ok: boolean; error: any; data: any };
  corefund?: {
    core_user_id: string | null;
    snapshot_source: string | null;
    snapshot: any;
    trades_source: string | null;
    trades: any[];
    limit_trades: number;
  };
  error?: string;
};

export default function AdminPlatform() {
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);

        // Must be signed in (admin) to access API via Bearer token
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Not signed in. Please login again.");

        const res = await fetch("/api/admin/institutional-snapshot?limit_trades=25", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const json = (await res.json()) as Resp;

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Request failed (${res.status})`);
        }

        setData(json);
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
        setData(null);
      }
    }

    load();
  }, []);

  if (err) return <div style={{ padding: 40 }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 40 }}>Loading platform metrics...</div>;

  const inst = data.institutional?.data;
  const core = data.corefund;

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>YieldCraft — Admin Platform</h1>
      <div style={{ opacity: 0.7, marginTop: 6 }}>
        As of: {data.as_of || "—"} • Snapshot: {data.institutional?.ok ? "OK" : "—"}
      </div>

      <hr style={{ margin: "24px 0", opacity: 0.2 }} />

      <h2>Institutional Snapshot (30d)</h2>
      <div>Total Users (30d): {inst?.total_users_30d ?? "—"}</div>
      <div>Active Users (24h): {inst?.active_users_24h ?? "—"}</div>
      <div>Total Trades (30d): {inst?.total_trades_30d ?? "—"}</div>
      <div>Volume (30d): ${Number(inst?.total_volume_usd_30d ?? 0).toFixed(2)}</div>
      <div>Avg Trade (30d): ${Number(inst?.avg_trade_usd_30d ?? 0).toFixed(2)}</div>
      <div>Maker % (entries): {Number(inst?.maker_entry_pct ?? 0).toFixed(2)}%</div>

      <div style={{ marginTop: 10 }}>
        <b>Win Rate:</b> {Number(inst?.win_rate_pct ?? 0).toFixed(2)}% •{" "}
        <b>Avg Exit:</b> {Number(inst?.avg_exit_bps ?? 0).toFixed(2)} bps •{" "}
        <b>Avg Hold:</b> {Number(inst?.avg_hold_minutes ?? 0).toFixed(1)} min
      </div>

      <div style={{ marginTop: 10 }}>
        <b>Total Equity:</b> ${Number(inst?.total_equity_usd ?? 0).toFixed(2)} •{" "}
        <b>Peak Equity:</b> ${Number(inst?.total_peak_equity_usd ?? 0).toFixed(2)} •{" "}
        <b>DD%:</b> {Number(inst?.dd_pct_portfolio ?? 0).toFixed(2)}%
      </div>

      <div style={{ marginTop: 10, opacity: 0.8 }}>
        Strategy: {inst?.strategy_version ?? "—"}
      </div>

      <hr style={{ margin: "24px 0", opacity: 0.2 }} />

      <h2>CoreFund</h2>
      <div>Core User: {core?.core_user_id ?? "—"}</div>
      <div>Snapshot Source: {core?.snapshot_source ?? "—"}</div>
      <div>Peak Equity: ${Number(core?.snapshot?.peak_equity_usd ?? 0).toFixed(2)}</div>
      <div>Current Equity: ${Number(core?.snapshot?.last_equity_usd ?? 0).toFixed(2)}</div>

      <h3 style={{ marginTop: 20 }}>Recent Trades</h3>
      <pre style={{ background: "#111", color: "#0f0", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(core?.trades ?? [], null, 2)}
      </pre>
    </div>
  );
}