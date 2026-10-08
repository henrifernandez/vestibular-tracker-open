import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";

// Converte erros internos em respostas genéricas. O erro completo vai só para o log do
// servidor; o corpo da resposta nunca carrega mensagens do Prisma ou de serviços externos.
export function erroDeApi(res: NextApiResponse, e: unknown) {
  console.error(e);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2025") return res.status(404).json({ error: "registro não encontrado" });
    if (e.code === "P2002") return res.status(409).json({ error: "registro duplicado" });
  }
  return res.status(500).json({ error: "erro interno" });
}

// Envolve uma rota para que qualquer exceção vire uma resposta genérica (e seja registrada no log).
export function comErros(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      return await handler(req, res);
    } catch (e) {
      if (res.headersSent) throw e;
      return erroDeApi(res, e);
    }
  };
}
