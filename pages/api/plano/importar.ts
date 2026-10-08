import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";
import { diaParaDate } from "@/lib/datas";
import { analisarCsvPlano } from "@/lib/plano";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const corpoSchema = z.object({
  csv: z.string().min(1, "csv vazio"),
  confirmar: z.boolean().optional(),
});

// POST { csv, confirmar? }
//   sem confirmar: devolve a prévia (linhas válidas, erros por linha), sem gravar
//   com confirmar: grava as linhas válidas (upsert por chaveExterna, idempotente)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const corpo = corpoSchema.safeParse(req.body);
  if (!corpo.success) return res.status(400).json({ error: "requisição inválida", detalhes: corpo.error.issues.map((i) => i.message) });

  const { linhas, erros, totalLinhas } = analisarCsvPlano(corpo.data.csv);

  if (!corpo.data.confirmar) {
    return res.status(200).json({ totalLinhas, validas: linhas.length, erros, amostra: linhas.slice(0, 50) });
  }

  if (linhas.length === 0) return res.status(400).json({ error: "nenhuma linha válida para importar", erros });

  try {
    const existentes = await prisma.planoEstudo.findMany({
      where: { chaveExterna: { in: linhas.map((l) => l.chaveExterna) } },
      select: { chaveExterna: true },
    });
    const jaExistem = new Set(existentes.map((e) => e.chaveExterna));

    await prisma.$transaction(
      linhas.map((l) => {
        const dados = {
          materia: l.materia,
          data: diaParaDate(l.data)!,
          topicos: l.topicos ?? null,
          feito: l.feito,
          observacoes: l.observacoes ?? null,
          ativo: true,
          origem: "CSV",
          syncedAt: new Date(),
        };
        return prisma.planoEstudo.upsert({
          where: { chaveExterna: l.chaveExterna },
          create: { chaveExterna: l.chaveExterna, ...dados },
          update: dados,
        });
      })
    );

    return res.status(200).json({
      criados: linhas.filter((l) => !jaExistem.has(l.chaveExterna)).length,
      atualizados: linhas.filter((l) => jaExistem.has(l.chaveExterna)).length,
      ignoradasComErro: erros.length,
    });
  } catch (e) {
    return erroDeApi(res, e);
  }
}
