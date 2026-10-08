import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";

// Itens ativos do plano de estudo (os que sumiram de uma sincronização ficam inativos).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  try {
    const itens = await prisma.planoEstudo.findMany({
      where: { ativo: true },
      orderBy: { data: "desc" },
      take: 1000,
    });
    return res.status(200).json(itens);
  } catch (e) {
    return erroDeApi(res, e);
  }
}
