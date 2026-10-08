import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv";
import { sincronizarSeguro } from "@/lib/revisao";
import { comErros } from "@/lib/erros";
import { diaParaDate, normalizarDia } from "@/lib/datas";

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
  },
};

const MAX_LINHAS_IMPORTACAO = 2000;


// Cabeçalho esperado (igual ao gerado por /api/simulados/[id]/export):
// Prova, Simulado, Data, Área, Acertos, Total de questões, % de acertos, Conteúdos errados
const COLUNAS = [
  "prova",
  "simulado",
  "data",
  "área",
  "acertos",
  "total de questões",
  "% de acertos",
  "conteúdos errados",
];

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

// Aceita "10/03/2026" (pt-BR) ou "2026-03-10" (ISO)
function parseData(valor: string): Date | null {
  const v = valor.trim();
  const dia = normalizarDia(v.slice(0, 10)) ?? normalizarDia(v);
  return dia ? diaParaDate(dia) : null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { csv } = (req.body ?? {}) as { csv?: string };
  if (!csv || typeof csv !== "string") {
    return res.status(400).json({ error: "Envie o conteúdo do CSV no campo 'csv'." });
  }

  const linhas = parseCSV(csv);
  if (linhas.length < 2) {
    return res.status(400).json({ error: "CSV vazio ou sem linhas de dados." });
  }
  if (linhas.length - 1 > MAX_LINHAS_IMPORTACAO) {
    return res.status(413).json({ error: `Máximo de ${MAX_LINHAS_IMPORTACAO} linhas por importação.` });
  }

  const cabecalho = linhas[0].map(normalizar);
  const indice = (nome: string) => cabecalho.indexOf(nome);
  const idxProva = indice("prova");
  const idxSimulado = indice("simulado");
  const idxData = indice("data");
  const idxArea = indice("área");
  const idxAcertos = indice("acertos");
  const idxTotal = indice("total de questões");
  const idxConteudos = indice("conteúdos errados");

  if ([idxProva, idxData, idxArea, idxAcertos, idxTotal].some((i) => i === -1)) {
    return res.status(400).json({
      error:
        "Cabeçalho do CSV não reconhecido. Colunas esperadas: " + COLUNAS.join(", "),
    });
  }

  const provas = await prisma.prova.findMany({ include: { areas: true } });
  const provaPorNome = new Map(provas.map((p) => [normalizar(p.nome), p]));

  const erros: string[] = [];
  type Grupo = {
    provaId: string;
    data: Date;
    nome: string | null;
    resultados: {
      areaId: string;
      acertos: number;
      totalQuestoes: number;
      conteudosErrados: string[];
    }[];
  };
  const grupos = new Map<string, Grupo>();

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const numeroLinha = i + 1;

    const nomeProva = linha[idxProva]?.trim();
    const prova = nomeProva ? provaPorNome.get(normalizar(nomeProva)) : undefined;
    if (!prova) {
      erros.push(`Linha ${numeroLinha}: prova "${nomeProva}" não encontrada.`);
      continue;
    }

    const nomeArea = linha[idxArea]?.trim();
    const area = prova.areas.find((a) => normalizar(a.nome) === normalizar(nomeArea || ""));
    if (!area) {
      erros.push(`Linha ${numeroLinha}: área "${nomeArea}" não encontrada em "${prova.nome}".`);
      continue;
    }

    const data = parseData(linha[idxData] || "");
    if (!data) {
      erros.push(`Linha ${numeroLinha}: data "${linha[idxData]}" inválida.`);
      continue;
    }

    const acertosTxt = (linha[idxAcertos] ?? "").trim();
    const totalTxt = (linha[idxTotal] ?? "").trim();
    const acertos = Number(acertosTxt);
    const totalQuestoes = Number(totalTxt);
    if (
      !acertosTxt ||
      !totalTxt ||
      acertos > 1000 ||
      totalQuestoes > 1000 ||
      !Number.isInteger(acertos) ||
      !Number.isInteger(totalQuestoes) ||
      acertos < 0 ||
      totalQuestoes < 0 ||
      acertos > totalQuestoes
    ) {
      erros.push(`Linha ${numeroLinha}: acertos/total inválidos (inteiros, sem negativos e acertos <= total).`);
      continue;
    }

    const nomeSimulado = idxSimulado !== -1 ? linha[idxSimulado]?.trim() || null : null;
    const conteudosErrados =
      idxConteudos !== -1
        ? (linha[idxConteudos] || "")
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
        : [];

    const chaveGrupo = `${prova.id}__${data.toISOString().slice(0, 10)}__${nomeSimulado ?? ""}`;
    if (!grupos.has(chaveGrupo)) {
      grupos.set(chaveGrupo, { provaId: prova.id, data, nome: nomeSimulado, resultados: [] });
    }
    if (grupos.get(chaveGrupo)!.resultados.some((r) => r.areaId === area.id)) {
      erros.push(`Linha ${numeroLinha}: área "${area.nome}" repetida no mesmo simulado.`);
      continue;
    }
    grupos.get(chaveGrupo)!.resultados.push({
      areaId: area.id,
      acertos,
      totalQuestoes,
      conteudosErrados,
    });
  }

  let criados = 0;
  let ignorados = 0;
  for (const grupo of grupos.values()) {
    // Idempotência: um simulado com a mesma prova, data e nome já existente não é criado de novo.
    const jaExiste = await prisma.simulado.findFirst({
      where: { data: grupo.data, nome: grupo.nome, provaId: grupo.provaId },
      select: { id: true },
    });
    if (jaExiste) {
      ignorados++;
      continue;
    }

    await prisma.simulado.create({
      data: {
        provaId: grupo.provaId,
        data: grupo.data,
        nome: grupo.nome,
        resultados: {
          create: grupo.resultados.map((r) => ({
            areaId: r.areaId,
            acertos: r.acertos,
            totalQuestoes: r.totalQuestoes,
            conteudosErrados: { create: r.conteudosErrados.map((c) => ({ conteudo: c })) },
          })),
        },
      },
    });
    criados++;
  }

  // Leva os conteúdos errados para a seção Revisão (null se a sincronização falhar).
  const revisao = criados > 0 ? await sincronizarSeguro() : null;

  res.status(200).json({ simuladosCriados: criados, simuladosJaExistentes: ignorados, erros, revisao, revisaoFalhou: criados > 0 && revisao === null });
}

export default comErros(handler);
