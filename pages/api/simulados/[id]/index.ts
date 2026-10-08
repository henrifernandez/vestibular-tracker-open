import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { comErros } from "@/lib/erros";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string" || id.length > 60) return res.status(400).json({ error: "id inválido" });

  if (req.method === "DELETE") {
    // P2025 (já excluído) vira 404 e o resto vira 500 genérico, em comErros
    await prisma.simulado.delete({ where: { id } });
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const simulado = await prisma.simulado.findUnique({
      where: { id },
      include: { prova: true, resultados: { include: { area: true, conteudosErrados: true } } },
    });
    if (!simulado) return res.status(404).json({ error: "não encontrado" });
    return res.status(200).json(simulado);
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  res.status(405).end();
}

export default comErros(handler);
