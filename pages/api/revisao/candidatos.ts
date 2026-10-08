import type { NextApiRequest, NextApiResponse } from "next";
import { listarCandidatos } from "@/lib/revisao";
import { comErros } from "@/lib/erros";

// Assuntos errados uma vez só, que não entram na Revisão sozinhos mas podem ser incluídos.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  res.status(200).json(await listarCandidatos());
}

export default comErros(handler);
