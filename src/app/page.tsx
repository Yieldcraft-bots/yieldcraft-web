export default function Home() {
  return (
    <main
      style={{
        fontFamily: "Inter, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "linear-gradient(180deg, #0a0f1c 0%, #101a2e 100%)",
        color: "#f2f2f2",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", color: "#f9d85a", marginBottom: "0.5rem" }}>
        YieldCraft
      </h1>
      <p style={{ fontSize: "1.2rem", maxWidth: "600px", lineHeight: 1.5 }}>
        The first multi-platform <b>direct-execution AI trading platform</b> for
        retail, prop, and enterprise — executing live on Coinbase, Kraken, and
        IBKR with institutional-grade predictive logic.
      </p>
      <a
        href="https://buy.stripe.com/5kQ6oJ3ypfnX9LK1ZN7kc03"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: "2rem",
          backgroundColor: "#f9d85a",
          color: "#0a0f1c",
          padding: "0.75rem 1.5rem",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        Subscribe Now — All-Access Pass
      </a>
      <p style={{ marginTop: "1.5rem", opacity: 0.8, fontSize: "0.9rem" }}>
        AI-powered. Secure. Built to outperform.
      </p>
    </main>
  );
}
