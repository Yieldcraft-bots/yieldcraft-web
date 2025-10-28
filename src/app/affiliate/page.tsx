'use client';
import { useEffect, useMemo, useState } from 'react';
import { captureRefFromURL, withRef, brandName, yc, getAffiliateParamName } from '@/lib/referral';

export default function AffiliatePage() {
  const [code, setCode] = useState('yourname');
  const [host, setHost] = useState('');
  const stripe = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || '';
  const coinbase = process.env.NEXT_PUBLIC_COINBASE_REF_URL || '';
  const param = getAffiliateParamName();

  useEffect(() => {
    captureRefFromURL();
    if (typeof window !== 'undefined') setHost(window.location.origin);
  }, []);

  const homepageLink = useMemo(() => (host ? `${host}/?${param}=${encodeURIComponent(code)}` : ''), [host, code, param]);

  const stripeLink = useMemo(() => {
    if (!stripe) return '';
    const url = new URL(stripe);
    if (!url.searchParams.get(param)) url.searchParams.set(param, code);
    return url.toString();
  }, [stripe, code, param]);

  const coinbaseLink = useMemo(() => {
    if (!coinbase) return '';
    const url = new URL(coinbase);
    if (!url.searchParams.get(param)) url.searchParams.set(param, code);
    return url.toString();
  }, [coinbase, code, param]);

  return (
    <main className="min-h-[100dvh] bg-[#0B1220] text-white">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h1 className={`text-4xl md:text-6xl font-extrabold mb-3 ${yc.goldText}`}>Affiliate Hub</h1>
        <p className={`${yc.muted} mb-10`}>Earn by sharing {brandName()}. Your code tracks across the whole site and into Stripe & Coinbase links.</p>

        <div className={`${yc.card} p-6 mb-8`}>
          <label className="block text-sm opacity-80 mb-2">Your referral code</label>
          <input
            value={code}
            onChange={(e)=>setCode(e.target.value.trim())}
            placeholder="e.g. dklein"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/20"
          />
          <p className={`text-xs ${yc.muted} mt-2`}>This will be appended as <code>?{param}=yourcode</code>.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card title="Homepage link" desc="Send traffic to the homepage (auto-tracks your code).">
            <CopyRow value={homepageLink} />
          </Card>

          <Card title="Stripe subscribe link" desc="Goes straight to checkout; your code is attached.">
            <CopyRow value={stripeLink} warnIfEmpty labelWhenEmpty="Set NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS" />
          </Card>

          <Card title="Coinbase link" desc="For new exchange signups (optional).">
            <CopyRow value={coinbaseLink} warnIfEmpty labelWhenEmpty="Set NEXT_PUBLIC_COINBASE_REF_URL" />
          </Card>
        </div>

        <div className={`${yc.card} p-6 mt-8`}>
          <h3 className="text-lg font-semibold mb-3">Best practices</h3>
          <ul className={`list-disc pl-6 space-y-2 text-sm ${yc.muted}`}>
            <li>Always share links that include your code (<code>?{param}=you</code>).</li>
            <li>Once a visitor hits the site, the code is saved for a year and auto-appends to future links.</li>
            <li>For email marketing, link both the homepage and the Subscribe button (checkout).</li>
            <li>Payouts are handled in Stripe; contact {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@yieldcraft.co'} if something looks off.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Card({ title, desc, children }:{ title:string; desc:string; children?:React.ReactNode }) {
  return (
    <div className={`${yc.card} p-6`}>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className={`${yc.muted} text-sm mb-3`}>{desc}</p>
      {children}
    </div>
  );
}

function CopyRow({ value, warnIfEmpty, labelWhenEmpty }:{
  value: string; warnIfEmpty?: boolean; labelWhenEmpty?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function onCopy(){
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(()=>setCopied(false), 1200);
  }
  return (
    <div>
      {warnIfEmpty && !value && <div className="text-xs text-red-300 mb-2">{labelWhenEmpty}</div>}
      <div className="flex items-center gap-2">
        <input readOnly value={value} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        <button disabled={!value} onClick={onCopy} className={`${yc.btn} ${yc.btnGold} whitespace-nowrap`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
