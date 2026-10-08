import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";
import { diaParaDate } from "@/lib/datas";
import { analisarCsvCalendario, analisarIcs } from "@/lib/calendario";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const corpoSchema = z.object({
  formato: z.enum(["csv", "ics"]),
  conteudo: z.string().min(1, "arquivo vazio"),
  confirmar: z.boolean().optional(),
});

// POST { formato, conteudo, confirmar? }: sem confirmar devolve a prévia; com confirmar grava (idempotente).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const corpo = corpoSchema.safeParse(req.body);
  if (!corpo.success) return res.status(400).json({ error: "requisição inválida", detalhes: corpo.error.issues.map((i) => i.message) });

  const { eventos, erros, avisos, total } =
    corpo.data.formato === "csv" ? analisarCsvCalendario(corpo.data.conteudo) : analisarIcs(corpo.data.conteudo);

  if (!corpo.data.confirmar) {
    return res.status(200).json({ total, validos: eventos.length, erros, avisos, amostra: eventos.slice(0, 50) });
  }
  if (eventos.length === 0) return res.status(400).json({ error: "nenhum evento válido para importar", erros });

  try {
    const existentes = await prisma.eventoCalendario.findMany({
      where: { chave: { in: eventos.map((e) => e.chave) } },
      select: { chave: true },
    });
    const jaExistem = new Set(existentes.map((e) => e.chave));

    await prisma.$transaction(
      eventos.map((e) => {
        const dados = {
          dia: diaParaDate(e.dia)!,
          inicio: e.inicio ?? null,
          fim: e.fim ?? null,
          titulo: e.titulo,
          categoria: e.categoria ?? "",
          tipo: e.tipo,
          descricao: e.descricao ?? null,
          origem: e.origem,
        };
        return prisma.eventoCalendario.upsert({ where: { chave: e.chave }, create: { chave: e.chave, ...dados }, update: dados });
      })
    );
    return res.status(200).json({
      criados: eventos.filter((e) => !jaExistem.has(e.chave)).length,
      atualizados: eventos.filter((e) => jaExistem.has(e.chave)).length,
      ignoradosComErro: erros.length,
      avisos,
    });
  } catch (e) {
    return erroDeApi(res, e);
  }
}
