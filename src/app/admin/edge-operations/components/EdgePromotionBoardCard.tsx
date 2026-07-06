export default function EdgePromotionBoardCard() {
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

      <p>
        Promotion board telemetry will appear here.
      </p>

      <ul>
        <li>Status: Placeholder</li>
        <li>Source: edge_promotion_board_v1</li>
        <li>Mode: Read Only</li>
      </ul>
    </section>
  );
}