// lib/referral.ts
export function getAffiliateParamName() {
  return process.env.NEXT_PUBLIC_AFFILIATE_PARAM || 'ref';
}

export function getStoredRef(): string | null {
  if (typeof window === 'undefined') return null;
  const p = getAffiliateParamName();
  try {
    const viaStorage = window.localStorage.getItem('yc_ref');
    if (viaStorage) return viaStorage;
    const m = document.cookie.match(new RegExp('(?:^|; )yc_ref=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch (_) {
    return null;
  }
}

export function setStoredRef(ref: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('yc_ref', ref);
    document.cookie = `yc_ref=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch (_) {}
}

export function captureRefFromURL() {
  if (typeof window === 'undefined') return;
  const p = getAffiliateParamName();
  const url = new URL(window.location.href);
  const ref = url.searchParams.get(p);
  if (ref) setStoredRef(ref);
}

export function withRef(url: string): string {
  const ref = getStoredRef();
  if (!ref) return url;
  const u = new URL(url);
  const p = getAffiliateParamName();
  if (!u.searchParams.get(p)) u.searchParams.set(p, ref);
  return u.toString();
}

export function brandName() {
  return process.env.NEXT_PUBLIC_BRAND_NAME || 'YieldCraft';
}

// Basic YC gradient helpers
export const yc = {
  gold: 'from-[#E6C875] via-[#E0B74E] to-[#C99A2E]',
  navy: 'text-[#0B1220]',
  goldText: 'bg-clip-text text-transparent bg-gradient-to-r from-[#E6C875] via-[#E0B74E] to-[#C99A2E]',
  card: 'rounded-2xl shadow-lg border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] backdrop-blur',
  btn: 'rounded-2xl px-5 py-3 font-semibold shadow hover:shadow-xl transition',
  btnGold: 'bg-gradient-to-r from-[#E6C875] via-[#E0B74E] to-[#C99A2E] text-[#0B1220] hover:opacity-95',
  muted: 'text-white/70',
};
