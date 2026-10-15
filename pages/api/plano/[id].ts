import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { comErros } from "@/lib/erros";

// Marca ou desmarca um dia do plano como feito. Só o campo `feito` pode mudar por aqui:
// matéria, data e tópicos vêm do CSV ou do Notion.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end();
  }

  const id = String(req.query.id).slice(0, 60);
  const feito = (req.body ?? {}).feito;
  if (typeof feito !== "boolean") {
    return res.status(400).json({ error: "Informe feito como true ou false." });
  }

  try {
    const item = await prisma.planoEstudo.update({ where: { id }, data: { feito } });
    return res.status(200).json({ item });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return res.status(404).json({ error: "Dia do plano não encontrado." });
    }
    throw e;
  }
}

export default comErros(handler);
