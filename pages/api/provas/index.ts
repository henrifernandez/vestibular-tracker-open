import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { comErros } from "@/lib/erros";
import { mensagensDeErro } from "@/lib/schemas";
import { MAX_PROVAS, metaDaArea, slugUnico } from "@/lib/provas";
import { provaCriarSchema } from "@/lib/provas-schemas";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const provas = await prisma.prova.findMany({
      include: {
        areas: {
          orderBy: { ordem: "asc" },
          include: { metas: true },
        },
      },
      orderBy: [{ dataProva: { sort: "asc", nulls: "last" } }, { nome: "asc" }],
    });
    return res.status(200).json(provas);
  }

  if (req.method === "POST") {
    const entrada = provaCriarSchema.safeParse(req.body);
    if (!entrada.success) {
      return res.status(400).json({ error: "dados inválidos", detalhes: mensagensDeErro(entrada.error) });
    }
    const { nome, descricao, dataProva, metaPercentual, areas } = entrada.data;

    const existentes = await prisma.prova.findMany({ select: { slug: true } });
    if (existentes.length >= MAX_PROVAS) {
      return res.status(400).json({ error: `Limite de ${MAX_PROVAS} provas. Exclua alguma antes de criar outra.` });
    }
    const slug = slugUnico(nome, new Set(existentes.map((p) => p.slug)));

    const prova = await prisma.prova.create({
      data: {
        slug,
        nome,
        descricao: descricao || null,
        dataProva: dataProva ?? null,
        metaPercentual: metaPercentual ?? null,
        areas: {
          create: areas.map((a, i) => ({
            nome: a.nome,
            totalQuestoes: a.totalQuestoes,
            ordem: i + 1,
            peso: a.peso ?? 1,
            ...(metaPercentual ? { metas: { create: [{ label: "Minha meta", ...metaDaArea(a, metaPercentual) }] } } : {}),
          })),
        },
      },
      include: { areas: { orderBy: { ordem: "asc" }, include: { metas: true } } },
    });
    return res.status(201).json(prova);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}

export default comErros(handler);
