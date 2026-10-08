import { z } from "zod";
import { detectarSeparador, parseCSV } from "./csv";
import { normalizarDia } from "./datas";
import { normalizarTexto } from "./texto";

export const MAX_LINHAS_PLANO = 2000;

export const COLUNAS_PLANO = ["data", "materia", "feito", "topicos", "observacoes"] as const;

export const linhaPlanoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser AAAA-MM-DD"),
  materia: z.string().trim().min(1, "matéria obrigatória").max(60, "matéria com mais de 60 caracteres"),
  feito: z.boolean(),
  topicos: z.string().trim().max(500, "tópicos com mais de 500 caracteres").optional().nullable(),
  observacoes: z.string().trim().max(2000, "observações com mais de 2000 caracteres").optional().nullable(),
});

export type LinhaPlano = z.infer<typeof linhaPlanoSchema> & { chaveExterna: string };

export function interpretarFeito(valor: string | undefined): boolean | null {
  const v = normalizarTexto(valor ?? "");
  if (["true", "sim", "s", "x", "1", "yes", "feito", "ok", "done", "concluido"].includes(v)) return true;
  if (["false", "nao", "n", "0", "no", "", "pendente"].includes(v)) return false;
  return null;
}

// A primeira linha de uma matéria num dia usa "csv:<matéria>:<dia>". As seguintes ganham ":2", ":3"...
// pela ordem no arquivo. Acrescentar linhas ou editar tópicos não muda a chave das que já existiam.
export function chaveCsv(materia: string, dia: string, ordinal: number): string {
  const base = `csv:${normalizarTexto(materia)}:${dia}`;
  return ordinal <= 1 ? base : `${base}:${ordinal}`;
}

export type ErroLinha = { linha: number; mensagem: string };
export type ResultadoCsv = { linhas: LinhaPlano[]; erros: ErroLinha[]; totalLinhas: number };

// Transforma linhas de qualquer origem (CSV, Notion) em linhas validadas e com chave estável.
export function validarLinhas(
  brutas: { n: number; data: string; materia: string; feito: boolean; topicos?: string | null; observacoes?: string | null; chaveExterna?: string }[]
): { linhas: LinhaPlano[]; erros: ErroLinha[] } {
  const erros: ErroLinha[] = [];
  const candidatas: { n: number; v: z.infer<typeof linhaPlanoSchema>; chave?: string }[] = [];

  for (const b of brutas) {
    const r = linhaPlanoSchema.safeParse({
      data: b.data,
      materia: b.materia,
      feito: b.feito,
      topicos: b.topicos || null,
      observacoes: b.observacoes || null,
    });
    if (!r.success) {
      erros.push({ linha: b.n, mensagem: r.error.issues.map((x) => x.message).join("; ") });
      continue;
    }
    candidatas.push({ n: b.n, v: r.data, chave: b.chaveExterna });
  }

  const ordinais = new Map<string, number>();
  const conteudos = new Set<string>();
  const vistas = new Set<string>();
  const linhas: LinhaPlano[] = [];
  for (const { n, v, chave } of candidatas) {
    const par = `${normalizarTexto(v.materia)}|${v.data}`;
    const conteudo = `${par}|${normalizarTexto(v.topicos ?? "")}`;
    if (conteudos.has(conteudo)) {
      erros.push({ linha: n, mensagem: "linha duplicada (mesma matéria, dia e tópicos)" });
      continue;
    }
    conteudos.add(conteudo);
    const ordinal = (ordinais.get(par) ?? 0) + 1;
    ordinais.set(par, ordinal);
    const chaveExterna = chave ?? chaveCsv(v.materia, v.data, ordinal);
    if (vistas.has(chaveExterna)) {
      erros.push({ linha: n, mensagem: "linha duplicada (mesma chave)" });
      continue;
    }
    vistas.add(chaveExterna);
    linhas.push({ ...v, chaveExterna });
  }
  return { linhas, erros };
}

export function analisarCsvPlano(texto: string): ResultadoCsv {
  const registros = parseCSV(texto, detectarSeparador(texto));
  if (registros.length === 0) return { linhas: [], erros: [{ linha: 1, mensagem: "arquivo vazio" }], totalLinhas: 0 };

  const cabecalho = registros[0].map((c) => normalizarTexto(c));
  const indice: Record<string, number> = {};
  for (const col of COLUNAS_PLANO) indice[col] = cabecalho.indexOf(col);

  const ausentes = (["data", "materia", "feito"] as const).filter((c) => indice[c] === -1);
  if (ausentes.length) {
    return {
      linhas: [],
      erros: [{ linha: 1, mensagem: `colunas obrigatórias ausentes: ${ausentes.join(", ")}` }],
      totalLinhas: 0,
    };
  }

  const dados = registros.slice(1);
  if (dados.length > MAX_LINHAS_PLANO) {
    return {
      linhas: [],
      erros: [{ linha: 1, mensagem: `máximo de ${MAX_LINHAS_PLANO} linhas por importação` }],
      totalLinhas: dados.length,
    };
  }

  const errosLeitura: ErroLinha[] = [];
  const brutas: Parameters<typeof validarLinhas>[0] = [];

  dados.forEach((campos, i) => {
    const n = i + 2; // linha no arquivo (1 é o cabeçalho)
    const pegar = (col: string) => (indice[col] >= 0 ? (campos[indice[col]] ?? "").trim() : "");
    const dia = normalizarDia(pegar("data"));
    const feito = interpretarFeito(pegar("feito"));
    if (!dia) return void errosLeitura.push({ linha: n, mensagem: `data inválida: "${pegar("data")}"` });
    if (feito === null) return void errosLeitura.push({ linha: n, mensagem: `valor de "feito" inválido: "${pegar("feito")}"` });
    brutas.push({ n, data: dia, materia: pegar("materia"), feito, topicos: pegar("topicos"), observacoes: pegar("observacoes") });
  });

  const { linhas, erros } = validarLinhas(brutas);
  return {
    linhas,
    erros: [...errosLeitura, ...erros].sort((a, b) => a.linha - b.linha),
    totalLinhas: dados.length,
  };
}
