import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";
import { diaParaDate } from "@/lib/datas";
import { calcularResumo, resolverPeriodo } from "@/lib/resumo";

const consultaSchema = z.object({
  inicio: z.string().optional(),
  fim: z.string().optional(),
});

// Resumo do período (padrão: últimos 7 dias): dias do plano feitos por matéria
// e simulados registrados no período.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const consulta = consultaSchema.safeParse(req.query);
  const periodo = consulta.success ? resolverPeriodo(consulta.data.inicio, consulta.data.fim) : null;
  if (!periodo) return res.status(400).json({ error: "inicio e fim devem ser datas AAAA-MM-DD, com inicio <= fim" });

  try {
    const [plano, simulados] = await Promise.all([
      prisma.planoEstudo.findMany({
        where: { ativo: true, data: { gte: diaParaDate(periodo.inicio)!, lte: diaParaDate(periodo.fim)! } },
        select: { materia: true, data: true, feito: true },
      }),
      prisma.simulado.findMany({
        where: { data: { gte: diaParaDate(periodo.inicio)!, lte: diaParaDate(periodo.fim)! } },
        include: { prova: true, resultados: { include: { area: true } } },
      }),
    ]);

    const itens = simulados.map((s) => {
      const objetivas = s.resultados.filter((r) => r.totalQuestoes > 0);
      const acertos = objetivas.reduce((t, r) => t + r.acertos, 0);
      const total = objetivas.reduce((t, r) => t + r.totalQuestoes, 0);
      return {
        id: s.id,
        nome: s.nome || s.prova.nome,
        data: s.data,
        resumo: total > 0 ? `${acertos}/${total} (${Math.round((acertos / total) * 100)}%)` : null,
      };
    });

    return res.status(200).json(calcularResumo(plano, itens, periodo));
  } catch (e) {
    return erroDeApi(res, e);
  }
}
