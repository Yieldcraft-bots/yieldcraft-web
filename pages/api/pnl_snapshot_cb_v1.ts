import type { NextApiRequest, NextApiResponse } from "next";

// Reuse whatever you already use in /api/pulse-manager to sign Coinbase JWT.
// If you already have a helper, import it instead of duplicating.
// The only requirement: a function that can do an authenticated fetch to api.coinbase.com.
async function coinbaseFetch(path: string, opts: RequestInit = {}) {
  // TODO: REPLACE THIS with your existing signed fetch helper from pulse-manager
  // e.g. return await signedCoinbaseFetch(path, opts)
  throw new Error("coinbaseFetch not wired: reuse pulse-manager signed fetch helper here");
}

function num(x: any): number {
  const n = typeof x === "string" ? parseFloat(x) : typeof x === "number" ? x : 0;
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const secret = String(req.query.secret || "");
    const CRON_SECRET = process.env.CRON_SECRET || "";
    if (!CRON_SECRET || secret !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const product_id = String(req.query.product_id || "BTC-USD");
    const days = Math.max(1, Math.min(60, num(req.query.days ?? 30))); // default 30d, cap 60d
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(sinceMs).toISOString();

    // Coinbase fills endpoint (advanced trade)
    // Docs naming varies; if this 404s, we’ll switch to the alternate path in pulse-manager.
    const fillsPath =
      `/api/v3/brokerage/orders/historical/fills?product_id=${encodeURIComponent(product_id)}&start_sequence_timestamp=${encodeURIComponent(sinceIso)}`;

    const r = await coinbaseFetch(fillsPath, { method: "GET" });
    const j: any = await r.json();

    // Normalize fills list
    const fills = j?.fills || j?.fill || j?.data || [];
    let realized = 0;
    let fees = 0;

    // Simple realized PnL via inventory method (FIFO-ish simplified):
    // Track position cost basis; realized PnL when selling.
    let posBase = 0;
    let posCost = 0;

    for (const f of fills) {
      const side = String(f?.side || "").toUpperCase();
      const size = num(f?.size || f?.base_size || f?.filled_size);
      const price = num(f?.price || f?.fill_price);
      const fee = num(f?.commission || f?.fee || f?.fees);

      if (!size || !price) continue;

      fees += fee;

      if (side === "BUY") {
        posBase += size;
        posCost += size * price;
      } else if (side === "SELL") {
        // average cost basis
        const avg = posBase > 0 ? posCost / posBase : 0;
        const soldCost = size * avg;
        const soldProceeds = size * price;
        realized += (soldProceeds - soldCost);
        posBase -= size;
        posCost -= soldCost;
        if (posBase < 0) { posBase = 0; posCost = 0; } // safety
      }
    }

    return res.status(200).json({
      ok: true,
      source: "coinbase_fills",
      product_id,
      since: sinceIso,
      fills_count: Array.isArray(fills) ? fills.length : 0,
      net_realized_pnl_usd: Math.round(realized * 100) / 100,
      fees_paid_usd: Math.round(fees * 100) / 100,
      open_position_base: Math.max(0, posBase),
      open_cost_usd: Math.round(posCost * 100) / 100,
      note: "This endpoint ignores Supabase trade_logs and computes from Coinbase fills.",
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}