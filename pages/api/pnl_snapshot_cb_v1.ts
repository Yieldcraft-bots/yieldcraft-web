import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const secret = (req.query.secret as string) || "";
    const expected = process.env.CRON_SECRET || "";

    if (!expected) {
      return res.status(500).json({ ok: false, error: "CRON_SECRET_missing" });
    }

    if (secret !== expected) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    return res.status(200).json({
      ok: true,
      source: "stub",
      now: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "unknown" });
  }
}