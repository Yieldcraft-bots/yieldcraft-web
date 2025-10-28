// src/app/auth/page.tsx
"use client";

export default function AuthPage() {
  return (
    <main className="yc-page">
      <section className="yc-section">
        <h1 className="yc-h1">Log in</h1>
        <p className="yc-sub">Auth coming next. For now, use the buttons below.</p>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <a className="yc-btn gold" href="/quick-start">Go to QuickStart</a>
          <a className="yc-btn ghost" href="/pricing">See Pricing</a>
          <a className="yc-btn ghost" href="/">Back Home</a>
        </div>
      </section>
    </main>
  );
}
