import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { comErros } from "@/lib/erros";
import { mensagensDeErro } from "@/lib/schemas";
import { metaDaArea } from "@/lib/provas";
import { provaAtualizarSchema } from "@/lib/provas-schemas";

async function atualizar(req: NextApiRequest, res: NextApiResponse, slug: string) {
  const entrada = provaAtualizarSchema.safeParse(req.body);
  if (!entrada.success) {
    return res.status(400).json({ error: "dados inválidos", detalhes: mensagensDeErro(entrada.error) });
  }
  const d = entrada.data;

  const prova = await prisma.prova.findUnique({ where: { slug }, include: { areas: true } });
  if (!prova) return res.status(404).json({ error: "prova não encontrada" });

  const edicoes = d.areas ?? [];
  const idsDaProva = new Set(prova.areas.map((a) => a.id));
  if (edicoes.some((a) => !idsDaProva.has(a.id))) {
    return res.status(400).json({ error: "área não pertence a esta prova" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.prova.update({
      where: { id: prova.id },
      data: {
        ...(d.nome !== undefined && { nome: d.nome }),
        ...(d.descricao !== undefined && { descricao: d.descricao || null }),
        ...(d.dataProva !== undefined && { dataProva: d.dataProva }),
        ...(d.metaPercentual !== undefined && { metaPercentual: d.metaPercentual }),
        ...(d.metaNota !== undefined && { metaNota: d.metaNota }),
      },
    });

    // Definir (ou limpar) a meta em porcentagem refaz a meta de todas as áreas.
    if (d.metaPercentual !== undefined) {
      await tx.meta.deleteMany({ where: { area: { provaId: prova.id } } });
      const pct = d.metaPercentual;
      if (pct != null) {
        await tx.meta.createMany({
          data: prova.areas.map((a) => ({ areaId: a.id, label: "Minha meta", ...metaDaArea(a, pct) })),
        });
      }
    }

    // Ajustes finos por área, depois da meta geral.
    for (const e of edicoes) {
      if (e.peso !== undefined) await tx.area.update({ where: { id: e.id }, data: { peso: e.peso } });
      if (e.acertosAlvo !== undefined || e.notaAlvo !== undefined) {
        await tx.meta.deleteMany({ where: { areaId: e.id } });
        if (e.acertosAlvo != null || e.notaAlvo != null) {
          await tx.meta.create({
            data: { areaId: e.id, label: "Minha meta", acertosAlvo: e.acertosAlvo ?? null, notaAlvo: e.notaAlvo ?? null },
          });
        }
      }
    }
  });

  return res.status(200).json({ ok: true });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query;
  if (typeof slug !== "string") return res.status(400).json({ error: "slug inválido" });

  if (req.method === "PATCH") return atualizar(req, res, slug);

  if (req.method === "DELETE") {
    // Apaga também as áreas, metas e simulados da prova (cascata no banco).
    await prisma.prova.delete({ where: { slug } });
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res.status(405).end();
  }

  const prova = await prisma.prova.findUnique({
    where: { slug },
    include: {
      areas: {
        orderBy: { ordem: "asc" },
        include: {
          metas: true,
          resultados: {
            include: {
              simulado: true,
              conteudosErrados: true,
            },
            orderBy: [{ simulado: { data: "asc" } }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!prova) return res.status(404).json({ error: "prova não encontrada" });

  // Para cada área, agrega a frequência de conteúdos errados (para o "clique dentro da matéria")
  const areasComAgregados = prova.areas.map((area) => {
    const contagem: Record<string, number> = {};
    for (const r of area.resultados) {
      for (const c of r.conteudosErrados) {
        contagem[c.conteudo] = (contagem[c.conteudo] || 0) + 1;
      }
    }
    const conteudosMaisErrados = Object.entries(contagem)
      .map(([conteudo, vezes]) => ({ conteudo, vezes }))
      .sort((a, b) => b.vezes - a.vezes);

    const totalAcertos = area.resultados.reduce((s, r) => s + r.acertos, 0);
    const totalQuestoesRespondidas = area.resultados.reduce((s, r) => s + r.totalQuestoes, 0);
    const percentualMedio =
      totalQuestoesRespondidas > 0 ? (totalAcertos / totalQuestoesRespondidas) * 100 : null;

    return {
      ...area,
      conteudosMaisErrados,
      percentualMedio,
      ultimoResultado: area.resultados[area.resultados.length - 1] || null,
    };
  });

  res.status(200).json({ ...prova, areas: areasComAgregados });
}

export default comErros(handler);
