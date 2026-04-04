import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getData() {
  const { data: current } = await supabase
    .from("edge_outcomes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: recentRows } = await supabase
    .from("edge_outcomes")
    .select("regime, structure, volatility_bps, outcome_15m_bps, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: structureTruth } = await supabase
    .from("edge_outcomes")
    .select("regime, structure, outcome_15m_bps")
    .not("outcome_15m_bps", "is", null);

  return {
    current: current?.[0] ?? null,
    recentRows: recentRows ?? [],
    structureTruth: structureTruth ?? [],
  };
}

export default async function EdgeLabPage() {
  const data = await getData();

  const avg15m =
    data.recentRows.length > 0
      ? data.recentRows.reduce(
          (sum: number, row: any) => sum + Number(row.outcome_15m_bps ?? 0),
          0
        ) / data.recentRows.length
      : 0;

  const edgeStatus =
    avg15m > 5 ? "STRONG EDGE" : avg15m > 0 ? "WEAK EDGE" : "NO EDGE";

  const grouped = data.structureTruth.reduce((acc: Record<string, any>, row: any) => {
    const key = `${row.regime}__${row.structure}`;
    if (!acc[key]) {
      acc[key] = {
        regime: row.regime,
        structure: row.structure,
        samples: 0,
        total15m: 0,
      };
    }
    acc[key].samples += 1;
    acc[key].total15m += Number(row.outcome_15m_bps ?? 0);
    return acc;
  }, {});

  const structureStats = Object.values(grouped)
    .map((item: any) => ({
      ...item,
      avg15m: item.samples > 0 ? item.total15m / item.samples : 0,
    }))
    .filter((item: any) => item.samples >= 3)
    .sort((a: any, b: any) => a.avg15m - b.avg15m);

  const doNotTrade = structureStats.filter((x: any) => x.avg15m < 0).slice(0, 2);
  const observeOnly = [...structureStats]
    .filter((x: any) => x.avg15m > 0)
    .sort((a: any, b: any) => b.avg15m - a.avg15m)[0];

  const statusTone =
    edgeStatus === "STRONG EDGE"
      ? {
          border: "rgba(34,197,94,0.45)",
          bg: "rgba(22,101,52,0.18)",
          text: "#dcfce7",
          glow: "rgba(34,197,94,0.18)",
          badge: "#86efac",
        }
      : edgeStatus === "WEAK EDGE"
      ? {
          border: "rgba(250,204,21,0.45)",
          bg: "rgba(133,77,14,0.18)",
          text: "#fef9c3",
          glow: "rgba(250,204,21,0.16)",
          badge: "#fde047",
        }
      : {
          border: "rgba(239,68,68,0.42)",
          bg: "rgba(127,29,29,0.18)",
          text: "#fee2e2",
          glow: "rgba(239,68,68,0.16)",
          badge: "#fca5a5",
        };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <section style={heroStyle}>
          <div style={eyebrowStyle}>Read-Only Intelligence Layer</div>

          <h1 style={heroTitleStyle}>Edge Lab</h1>

          <p style={heroCopyStyle}>
            Market truth engine for regime, structure, and forward outcome behavior.
            This page exists to detect real edge and protect capital before risk is taken.
            No trading logic runs here.
          </p>
        </section>

        <section
          style={{
            ...statusCardStyle,
            border: `1px solid ${statusTone.border}`,
            background: `linear-gradient(135deg, ${statusTone.bg} 0%, rgba(255,255,255,0.02) 100%)`,
            boxShadow: `0 16px 48px ${statusTone.glow}`,
          }}
        >
          <div style={sectionLabelStyle}>Edge Status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: statusTone.badge,
                boxShadow: `0 0 18px ${statusTone.badge}`,
                display: "inline-block",
              }}
            />
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: statusTone.text }}>
              {edgeStatus}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, opacity: 0.88 }}>({avg15m.toFixed(2)} bps)</div>
          </div>
        </section>

        <section style={metricsGridStyle}>
          <MetricCard title="Regime" value={data.current?.regime} tone="neutral" />
          <MetricCard title="Structure" value={data.current?.structure} tone="neutral" />
          <MetricCard title="Volatility" value={data.current?.volatility_bps} tone="neutral" />
          <MetricCard
            title="15m Outcome"
            value={data.current?.outcome_15m_bps}
            tone={Number(data.current?.outcome_15m_bps) > 0 ? "good" : Number(data.current?.outcome_15m_bps) < 0 ? "bad" : "neutral"}
          />
        </section>

        <section style={insightGridStyle}>
          <InsightCard
            title="Do Not Trade Zones"
            tone="bad"
            items={doNotTrade.map(
              (z: any) =>
                `${z.regime} / ${z.structure} → ${z.avg15m.toFixed(2)} bps (${z.samples} samples)`
            )}
          />

          <InsightCard
            title="Observe Only"
            tone="warn"
            items={
              observeOnly
                ? [
                    `${observeOnly.regime} / ${observeOnly.structure} → ${observeOnly.avg15m.toFixed(
                      2
                    )} bps (${observeOnly.samples} samples)`,
                  ]
                : ["No positive pocket yet."]
            }
          />
        </section>

        <section style={tableWrapStyle}>
          <div style={tableHeaderStyle}>
            <div style={tableTitleStyle}>Recent Scored Rows</div>
            <div style={tableSubStyle}>Latest edge outcomes flowing into the truth layer.</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Regime</th>
                  <th style={thStyle}>Structure</th>
                  <th style={thStyle}>Volatility</th>
                  <th style={thStyle}>15m Outcome</th>
                  <th style={thStyle}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRows.map((row: any, i: number) => {
                  const outcome = Number(row.outcome_15m_bps ?? 0);
                  const outcomeColor =
                    outcome > 0 ? "#86efac" : outcome < 0 ? "#fca5a5" : "#e5e7eb";

                  return (
                    <tr key={i}>
                      <td style={tdStyle}>{row.regime}</td>
                      <td style={tdStyle}>{row.structure}</td>
                      <td style={tdStyle}>{row.volatility_bps}</td>
                      <td style={{ ...tdStyle, color: outcomeColor, fontWeight: 700 }}>
                        {row.outcome_15m_bps}
                      </td>
                      <td style={tdStyle}>{row.created_at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: any;
  tone: "neutral" | "good" | "bad";
}) {
  const toneStyles =
    tone === "good"
      ? {
          border: "rgba(34,197,94,0.24)",
          value: "#dcfce7",
          glow: "rgba(34,197,94,0.08)",
        }
      : tone === "bad"
      ? {
          border: "rgba(239,68,68,0.24)",
          value: "#fee2e2",
          glow: "rgba(239,68,68,0.08)",
        }
      : {
          border: "rgba(255,255,255,0.08)",
          value: "#f8fafc",
          glow: "rgba(255,255,255,0.03)",
        };

  return (
    <div
      style={{
        padding: 18,
        border: `1px solid ${toneStyles.border}`,
        borderRadius: 20,
        background: "rgba(255,255,255,0.025)",
        boxShadow: `0 12px 28px ${toneStyles.glow}`,
      }}
    >
      <div style={metricLabelStyle}>{title}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: toneStyles.value,
          letterSpacing: "-0.02em",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function InsightCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "bad" | "warn";
  items: string[];
}) {
  const toneStyles =
    tone === "bad"
      ? {
          accent: "#f87171",
          border: "rgba(239,68,68,0.36)",
          bg: "rgba(127,29,29,0.14)",
        }
      : {
          accent: "#facc15",
          border: "rgba(250,204,21,0.34)",
          bg: "rgba(133,77,14,0.12)",
        };

  return (
    <div
      style={{
        padding: 20,
        border: `1px solid ${toneStyles.border}`,
        borderRadius: 22,
        background: toneStyles.bg,
        boxShadow: `0 14px 36px ${toneStyles.bg}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: toneStyles.accent,
          marginBottom: 14,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{ lineHeight: 1.5, fontSize: 16, fontWeight: 500 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "28px 20px 56px",
};

const containerStyle = {
  maxWidth: 1380,
  margin: "0 auto",
};

const heroStyle = {
  marginBottom: 20,
  padding: 28,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(135deg, rgba(8,20,40,0.92) 0%, rgba(12,35,66,0.90) 55%, rgba(32,27,10,0.70) 100%)",
  boxShadow: "0 28px 70px rgba(0,0,0,0.24)",
  backdropFilter: "blur(10px)",
};

const eyebrowStyle = {
  display: "inline-flex",
  alignItems: "center",
  marginBottom: 14,
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid rgba(250,204,21,0.24)",
  background: "rgba(250,204,21,0.08)",
  color: "#facc15",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  fontSize: 38,
  lineHeight: 1.02,
  margin: "0 0 10px",
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const heroCopyStyle = {
  margin: 0,
  maxWidth: 880,
  fontSize: 16,
  lineHeight: 1.7,
  opacity: 0.82,
};

const statusCardStyle = {
  marginBottom: 20,
  padding: 22,
  borderRadius: 22,
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  opacity: 0.72,
  marginBottom: 10,
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const metricLabelStyle = {
  fontSize: 11,
  opacity: 0.7,
  marginBottom: 8,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  fontWeight: 800,
};

const insightGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 16,
  marginBottom: 24,
};

const tableWrapStyle = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  overflow: "hidden",
  background: "rgba(7,14,28,0.58)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
};

const tableHeaderStyle = {
  padding: "18px 20px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const tableTitleStyle = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  marginBottom: 4,
};

const tableSubStyle = {
  opacity: 0.68,
  fontSize: 13,
};

const thStyle = {
  textAlign: "left" as const,
  padding: "13px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  opacity: 0.68,
};

const tdStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  fontSize: 15,
};