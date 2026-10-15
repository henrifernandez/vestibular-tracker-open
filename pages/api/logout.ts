import type { NextApiRequest, NextApiResponse } from "next";
import { cookieDeLogout, cookieSeguro } from "@/lib/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  res.setHeader("Set-Cookie", cookieDeLogout(cookieSeguro()));
  return res.status(200).json({ ok: true });
}
