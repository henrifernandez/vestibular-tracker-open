import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";
import { diaParaDate } from "@/lib/datas";
import { NotionErro, buscarLinhas, notionConfigurado, testarConexao } from "@/lib/notion";
import { validarLinhas } from "@/lib/plano";

export const config = { maxDuration: 60 };

const corpoSchema = z.object({ acao: z.enum(["testar", "sincronizar"]) });

// Limite de uma sincronização por minuto (memória da instância; freio de melhor esforço).
let ultimaSincronizacao = 0;

// GET devolve só se a integração está configurada (a interface mostra ou esconde o botão).
// POST { acao: "testar" | "sincronizar" }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return res.status(200).json({ configurado: notionConfigurado() });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }
  if (!notionConfigurado()) return res.status(400).json({ error: "integração com o Notion não configurada" });

  const corpo = corpoSchema.safeParse(req.body);
  if (!corpo.success) return res.status(400).json({ error: "ação inválida" });

  try {
    if (corpo.data.acao === "testar") {
      const { titulo, problemas } = await testarConexao();
      return res.status(200).json({ titulo, ok: problemas.length === 0, problemas });
    }

    if (Date.now() - ultimaSincronizacao < 60_000) {
      return res.status(429).json({ error: "Aguarde um minuto entre sincronizações." });
    }
    ultimaSincronizacao = Date.now();

    const { linhas: brutas, erros: errosLeitura, completo } = await buscarLinhas();
    const { linhas, erros } = validarLinhas(brutas);

    await prisma.$transaction(
      linhas.map((l) => {
        const dados = {
          materia: l.materia,
          data: diaParaDate(l.data)!,
          topicos: l.topicos ?? null,
          feito: l.feito,
          observacoes: l.observacoes ?? null,
          ativo: true,
          origem: "NOTION",
          syncedAt: new Date(),
        };
        return prisma.planoEstudo.upsert({
          where: { chaveExterna: l.chaveExterna },
          create: { chaveExterna: l.chaveExterna, ...dados },
          update: dados,
        });
      })
    );

    // Reconciliação: o que sumiu do Notion fica inativo (histórico preservado).
    // Só roda se a leitura foi completa e sem erros, para nunca esconder dados por uma falha parcial.
    const reconciliar = completo && errosLeitura.length === 0 && erros.length === 0 && linhas.length > 0;
    let inativados = 0;
    if (reconciliar) {
      const r = await prisma.planoEstudo.updateMany({
        where: { origem: "NOTION", ativo: true, chaveExterna: { notIn: linhas.map((l) => l.chaveExterna) } },
        data: { ativo: false },
      });
      inativados = r.count;
    }

    return res.status(200).json({
      sincronizados: linhas.length,
      inativados,
      erros: [...errosLeitura, ...erros],
      reconciliado: reconciliar,
    });
  } catch (e) {
    ultimaSincronizacao = 0; // falhou: permite tentar de novo
    if (e instanceof NotionErro) {
      console.error("notion:", e.message);
      return res.status(e.status === 429 ? 429 : 502).json({ error: e.message });
    }
    return erroDeApi(res, e);
  }
}
