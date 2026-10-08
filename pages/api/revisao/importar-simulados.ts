import type { NextApiRequest, NextApiResponse } from "next";
import { sincronizarSimulados } from "@/lib/revisao";
import { comErros } from "@/lib/erros";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const resultado = await sincronizarSimulados();
  res.status(200).json(resultado);
}

export default comErros(handler);
