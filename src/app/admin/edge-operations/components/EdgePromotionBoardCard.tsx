type PromotionBoardRow = {
  product_id: string;
  signal: string;
  regime: string;
  structure: string;
  minutes: number;
  samples: number;
  avg_edge_bps: string;
  win_rate_pct: string;
  promotion_status: string;
};

async function getPromotionBoard() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/edge-promotion-board`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return Array.isArray(json.candidates) ? json.candidates : [];
}

export default async function EdgePromotionBoardCard() {
  const candidates = await getPromotionBoard();
  const topCandidates = candidates.slice(0, 5) as PromotionBoardRow[];

  return (
    <section
      style={{
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "16px",
        marginTop: "16px",
      }}
    >
      <h2>Promotion Board</h2>

      <p>Read-only telemetry from edge_promotion_board_v1.</p>

      <ul>
        {topCandidates.map((row) => (
          <li key={`${row.product_id}-${row.signal}-${row.regime}-${row.structure}-${row.minutes}`}>
            {row.product_id} · {row.signal} · {row.regime}/{row.structure} ·{" "}
            {row.minutes}m · {row.samples} samples · {row.win_rate_pct}% WR ·{" "}
            {row.avg_edge_bps} bps · {row.promotion_status}
          </li>
        ))}
      </ul>
    </section>
  );
}