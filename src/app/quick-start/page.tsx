'use client';
import { useEffect, useState } from 'react';
import { captureRefFromURL, withRef, brandName, yc } from '@/lib/referral';

export default function QuickStartPage() {
  const [stripe, setStripe] = useState('');
  const [coinbase, setCoinbase] = useState('');
  const [hbUrl, setHbUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    captureRefFromURL();
    setStripe(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ALL_ACCESS || '');
    setCoinbase(process.env.NEXT_PUBLIC_COINBASE_REF_URL || '');
    setHbUrl(process.env.NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL || '');
  }, []);

  async function handleStartBot() {
    if (!hbUrl) {
      setToast('Missing NEXT_PUBLIC_HEARTBEAT_PUBLIC_URL');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(hbUrl, { method: 'GET', cache: 'no-store' });
      const text = await res.text();
      setToast(res.ok ? '✅ Bot pinged successfully. Check logs for fills.' : `⚠️ ${res.status} ${text.slice(0,120)}`);
    } catch (e: any) {
      setToast(`⚠️ ${e?.message || 'Network error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#0B1220] text-white">
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h1 className={`text-4xl md:text-6xl font-extrabold mb-3 ${yc.goldText}`}>QuickStart</h1>
        <p className={`${yc.muted} mb-10`}>
          Connect · Subscribe · Configure · Go Live — all in minutes with {brandName()}.
        </p>

        <div className="grid md:grid-cols-4 gap-6">
          <Step title="Connect Exchange" desc="Open a Coinbase Advanced account. No withdrawals on API keys.">
            <a href={coinbase ? withRef(coinbase) : '#'} target="_blank" rel="noreferrer"
               className={`${yc.btn} ${yc.btnGold} w-full text-center`}>Open with Coinbase</a>
          </Step>

          <Step title="Subscribe" desc="All-Access (Pulse + Recon). Cancel anytime.">
            <a href={stripe ? withRef(stripe) : '#'} target="_blank" rel="noreferrer"
               className={`${yc.btn} ${yc.btnGold} w-full text-center`}>Subscribe Now</a>
          </Step>

          <Step title="Configure Risk" desc="Start safe defaults: $100 notional, maker-only, cooldown 60 s." />

          <Step title="Start Bot" desc="Ping the public heartbeat endpoint to begin.">
            <button onClick={handleStartBot} disabled={busy}
                    className={`${yc.btn} ${yc.btnGold} w-full ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
              {busy ? 'Starting…' : 'Start Pulse + Recon'}
            </button>
          </Step>
        </div>

        {toast && (
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            {toast}
          </div>
        )}

        <div className={`mt-12 text-sm ${yc.muted}`}>
          Need help? Email {process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@yieldcraft.co'}
        </div>
      </section>
    </main>
  );
}

function Step({ title, desc, children }:{title:string;desc:string;children?:React.ReactNode;}) {
  return (
    <div className={`${yc.card} p-6`}>
      <div className="text-sm uppercase tracking-wider opacity-70 mb-2">Step</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className={`${yc.muted} mb-4`}>{desc}</p>
      {children}
    </div>
  );
}
