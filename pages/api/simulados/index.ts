import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { montarResultadosCreate, type ResultadoInput } from "@/lib/simulados";
import { sincronizarSeguro } from "@/lib/revisao";
import { comErros } from "@/lib/erros";
import { mensagensDeErro, simuladoCriarSchema } from "@/lib/schemas";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const simulados = await prisma.simulado.findMany({
      include: {
        prova: true,
        resultados: { include: { area: true, conteudosErrados: true } },
      },
      orderBy: { data: "desc" },
    });
    return res.status(200).json(simulados);
  }

  if (req.method === "POST") {
    const entrada = simuladoCriarSchema.safeParse(req.body);
    if (!entrada.success) {
      return res.status(400).json({ error: "dados inválidos", detalhes: mensagensDeErro(entrada.error) });
    }
    const { provaId, data, nome, observacao } = entrada.data;
    const resultados = entrada.data.resultados as ResultadoInput[];

    const prova = await prisma.prova.findUnique({ where: { id: provaId }, include: { areas: { select: { id: true } } } });
    if (!prova) {
      return res.status(400).json({ error: "prova não encontrada" });
    }
    const areasDaProva = new Set(prova.areas.map((a) => a.id));
    if (resultados.some((r) => !areasDaProva.has(r.areaId))) {
      return res.status(400).json({ error: "dados inválidos", detalhes: ["alguma área não pertence a esta prova"] });
    }

    const simulado = await prisma.simulado.create({
      data: {
        provaId,
        data,
        nome,
        observacao,
        resultados: { create: montarResultadosCreate(resultados) },
      },
      include: {
        resultados: { include: { area: true, conteudosErrados: true } },
      },
    });

    const revisao = await sincronizarSeguro();
    return res.status(201).json({ ...simulado, revisao });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

export default comErros(handler);
