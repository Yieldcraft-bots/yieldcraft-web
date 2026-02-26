// src/app/api/recon-signal/route.ts
// Recon v1: lightweight trend/chop filter using Coinbase candles.
// Goal: stop bad entries; allow entries mainly when trend quality is high.

import { NextResponse } from "next/server";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";

export const runtime = "nodejs";

// ---- config ----
const PRODUCT_ID = process.env.RECON_PRODUCT_ID?.trim() || "BTC-USD";
const GRAN = process.env.RECON_CANDLE_GRANULARITY?.trim() || "ONE_MINUTE";
const LOOKBACK_MIN = Number(process.env.RECON_LOOKBACK_MIN || 120); // 2h default
const MIN_CONF = Number(process.env.RECON_MIN_CONF || 0.65);

// Signal thresholds (tune later)
const BUY_SCORE_MIN = Number(process.env.RECON_BUY_SCORE_MIN || 0.55);
const SELL_SCORE_MAX = Number(process.env.RECON_SELL_SCORE_MAX || 0.45);
const CHOP_MAX = Number(process.env.RECON_CHOP_MAX || 0.60); // higher = more choppy

// ---- helpers ----
function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function normalizePem(pem: string) {
  let p = (pem || "").trim();
  if (
    (p.startsWith('"') && p.endsWith('"')) ||
    (p.startsWith("'") && p.endsWith("'"))
  ) {
    p = p.slice(1, -1);
  }
  return p.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
}
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}
function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---- Coinbase CDP JWT (read-only) ----
function alg(): "ES256" | "EdDSA" {
  const raw = (process.env.COINBASE_KEY_ALG || "").toLowerCase();
  if (raw.includes("ed") || raw.includes("eddsa") || raw.includes("ed25519")) return "EdDSA";
  return "ES256";
}
function buildCdpJwt(method: "GET" | "POST", path: string) {
  const apiKeyName = requireEnv("COINBASE_API_KEY_NAME");
  const privateKeyPem = normalizePem(requireEnv("COINBASE_PRIVATE_KEY"));

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString("hex");

  const pathForUri = path.split("?")[0];
  const uri = `${method} api.coinbase.com${pathForUri}`;

  const payload = { iss: "cdp", sub: apiKeyName, nbf: now, exp: now + 60, uri };
  const options: SignOptions = {
    algorithm: (alg() === "EdDSA" ? "EdDSA" : "ES256") as any,
    header: { kid: apiKeyName, nonce } as any,
  };

  return jwt.sign(payload as any, privateKeyPem as any, options as any);
}
async function cbGet(path: string) {
  const token = buildCdpJwt("GET", path);
  const res = await fetch(`https://api.coinbase.com${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: safeJsonParse(text), text };
}

// ---- signal math ----
type Candle = { start?: string | number; high?: string | number; low?: string | number; close?: string | number };
function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function computeSignal(candles: any[]) {
  // Expect Coinbase candles array with {start, high, low, close}
  const cs = (Array.isArray(candles) ? candles : []).slice().reverse(); // oldest -> newest
  if (cs.length < 20) return { ok: false as const, error: "not_enough_candles", n: cs.length };

  const closes = cs.map((c) => toNum(c.close ?? c.c));
  const highs = cs.map((c) => toNum(c.high ?? c.h));
  const lows  = cs.map((c) => toNum(c.low ?? c.l));

  const last = closes[closes.length - 1];
  if (!(last > 0)) return { ok: false as const, error: "bad_last_price" };

  // Simple momentum: compare short vs long SMA
  const sma = (arr: number[], w: number) => {
    if (arr.length < w) return arr[arr.length - 1];
    let s = 0;
    for (let i = arr.length - w; i < arr.length; i++) s += arr[i];
    return s / w;
  };
  const sma20 = sma(closes, 20);
  const sma60 = sma(closes, Math.min(60, closes.length));
  const mom = (sma20 - sma60) / sma60; // normalized

  // Trend score in [0,1] using a squash
  const trendScore = 1 / (1 + Math.exp(-mom * 40)); // steeper

  // Chop score: average intrabar range / drift
  let rangeSum = 0;
  for (let i = 0; i < cs.length; i++) {
    const mid = (highs[i] + lows[i]) / 2;
    if (mid > 0) rangeSum += (highs[i] - lows[i]) / mid;
  }
  const avgRange = rangeSum / cs.length;

  const drift = Math.abs((closes[closes.length - 1] - closes[0]) / closes[0]);
  const chop = drift > 0 ? Math.min(1, avgRange / (drift * 2)) : 1; // higher => more chop

  // Confidence: trend minus chop penalty, clamped
  const conf = Math.max(0, Math.min(1, trendScore * (1 - Math.min(1, chop)) + 0.25));

  // Regime labels
  const regime =
    chop > CHOP_MAX ? "choppy_range" :
    trendScore >= 0.55 ? "bullish_trending" :
    trendScore <= 0.45 ? "bearish_trending" :
    "neutral";

  // Decision
  let side: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (chop <= CHOP_MAX && trendScore >= BUY_SCORE_MIN && conf >= MIN_CONF) side = "BUY";
  else if (chop <= CHOP_MAX && trendScore <= SELL_SCORE_MAX && conf >= MIN_CONF) side = "SELL";
  else side = "HOLD";

  return {
    ok: true as const,
    side,
    confidence: Number(conf.toFixed(2)),
    regime,
    meta: {
      model: "yc-recon-v1-trendfilter",
      trendScore: Number(trendScore.toFixed(3)),
      chopScore: Number(chop.toFixed(3)),
      sma20: Number(sma20.toFixed(2)),
      sma60: Number(sma60.toFixed(2)),
      last: Number(last.toFixed(2)),
      lookbackMin: LOOKBACK_MIN,
      granularity: GRAN,
    },
  };
}

export async function GET() {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - LOOKBACK_MIN * 60_000);
    const startTs = String(Math.floor(start.getTime() / 1000));
    const endTs = String(Math.floor(end.getTime() / 1000));

    const path = `/api/v3/brokerage/products/${encodeURIComponent(PRODUCT_ID)}/candles?start=${encodeURIComponent(
      startTs
    )}&end=${encodeURIComponent(endTs)}&granularity=${encodeURIComponent(GRAN)}`;

    const r = await cbGet(path);
    if (!r.ok) {
      return json(200, {
        side: "HOLD",
        confidence: 0.0,
        regime: "error",
        meta: { model: "yc-recon-v1-trendfilter", note: "coinbase_fetch_failed", status: r.status },
      });
    }

    const candles = (r.json as any)?.candles || [];
    const sig = computeSignal(candles);

    if (!sig.ok) {
      return json(200, {
        side: "HOLD",
        confidence: 0.0,
        regime: "error",
        meta: { model: "yc-recon-v1-trendfilter", note: sig.error, n: (sig as any).n },
      });
    }

    return json(200, sig);
  } catch (e: any) {
    return json(200, {
      side: "HOLD",
      confidence: 0.0,
      regime: "error",
      meta: { model: "yc-recon-v1-trendfilter", note: String(e?.message || e) },
    });
  }
}