import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  PRIORIDADES,
  STATUS,
  carregarGrupos,
  classificarDisciplina,
  normalizarAssunto,
  ordenarParaRevisao,
} from "@/lib/revisao";
import { comErros } from "@/lib/erros";

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const status = texto(req.query.status);
    const disciplina = texto(req.query.disciplina);
    const prioridade = texto(req.query.prioridade);

    // quantos simulados diferentes tiveram cada assunto (calculado na hora, sem coluna no banco)
    const grupos = await carregarGrupos();

    const itens = await prisma.conteudoRevisao.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(disciplina ? { disciplina } : {}),
        ...(prioridade ? { prioridade } : {}),
      },
      include: {
        logs: { orderBy: { revisadoEm: "desc" }, take: 1 },
        _count: { select: { logs: true } },
      },
    });

    const lista = itens.map(({ logs, _count, ...c }) => ({
      ...c,
      simulados: grupos.get(c.assuntoNorm)?.simulados ?? 0,
      ultimaRevisao: logs[0]?.revisadoEm ?? null,
      ultimaConfianca: logs[0]?.confianca ?? null,
      totalRevisoes: _count.logs,
    }));
    return res.status(200).json(ordenarParaRevisao(lista));
  }

  if (req.method === "POST") {
    const assunto = texto(req.body?.assunto);
    if (!assunto) return res.status(400).json({ error: "Informe o assunto." });
    if (assunto.length > 200) return res.status(400).json({ error: "O assunto deve ter até 200 caracteres." });
    const obs = texto(req.body?.observacao);
    if (obs && obs.length > 2000) return res.status(400).json({ error: "A observação deve ter até 2000 caracteres." });

    const prioridade = texto(req.body?.prioridade) ?? "MEDIA";
    if (!(PRIORIDADES as readonly string[]).includes(prioridade)) {
      return res.status(400).json({ error: "Prioridade inválida." });
    }

    const assuntoNorm = normalizarAssunto(assunto);
    // Se o assunto já foi errado em simulados, herda a contagem de erros e a área.
    const grupo = (await carregarGrupos()).get(assuntoNorm);
    const disciplinaInformada = texto(req.body?.disciplina);
    const disciplina = disciplinaInformada ?? classificarDisciplina(assunto, grupo?.areaNome);

    // Com disciplina escolhida, duplicata é o par (assunto, disciplina); sem ela,
    // o mesmo assunto em qualquer disciplina já conta.
    const existente = disciplinaInformada
      ? await prisma.conteudoRevisao.findUnique({
          where: { assuntoNorm_disciplina: { assuntoNorm, disciplina } },
        })
      : await prisma.conteudoRevisao.findFirst({ where: { assuntoNorm } });
    if (existente) {
      return res
        .status(200)
        .json({ item: existente, aviso: "Esse conteúdo já estava cadastrado." });
    }

    const item = await prisma.conteudoRevisao.create({
      data: {
        assunto,
        assuntoNorm,
        disciplina,
        prioridade,
        status: STATUS[0],
        origem: "MANUAL",
        vezesErrado: grupo?.vezes ?? 0,
        observacao: texto(req.body?.observacao),
        areaId: texto(req.body?.areaId) ?? grupo?.areaId,
      },
    });
    return res.status(201).json({ item });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}

export default comErros(handler);
