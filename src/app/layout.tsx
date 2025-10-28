<header className="yc-topbar">
  <div className="yc-topbar__left">
    <a href="/" className="yc-brand">YieldCraft</a>
  </div>

  <nav className="yc-nav">
    <a href="/bots">Bots</a>
    <a href="/why">Why YieldCraft</a>
    <a href="/pricing">Pricing</a>
    <a href="/quick-start" className="yc-btn ghost">QuickStart</a>
    <a href="/affiliate" className="yc-btn ghost">Affiliate</a>
    <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || "#"}
       target="_blank" rel="noreferrer" className="yc-btn gold">
      Subscribe
    </a>
  </nav>
</header>
