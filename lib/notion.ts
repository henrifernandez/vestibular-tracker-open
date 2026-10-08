import { FUSO } from "./datas";
import { interpretarFeito } from "./plano";
import { normalizarTexto } from "./texto";

// Único módulo que fala com a API do Notion. Somente leitura.
// A versão é fixada: o Notion informa que não pretende descontinuar versões antigas.
export const NOTION_VERSION = "2022-06-28";
const BASE = "https://api.notion.com/v1";
const POR_PAGINA = 100;
const MAX_PAGINAS = 20; // 2.000 itens, o mesmo limite da importação de CSV
const PAUSA_MS = 350; // a API aceita cerca de 3 requisições por segundo
const TIMEOUT_MS = 10_000;

export class NotionErro extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function notionConfigurado(): boolean {
  return Boolean(process.env.NOTION_TOKEN) && Boolean(process.env.NOTION_DATABASE_ID);
}

type Propriedade = { type: string; [k: string]: unknown };
type Esquema = Record<string, Propriedade>;

// Nomes aceitos para cada coluna (comparados sem acento e em minúsculas).
const NOMES: Record<string, string[]> = {
  data: ["data", "dia", "date"],
  materia: ["materia", "disciplina", "subject"],
  feito: ["feito", "concluido", "done"],
  topicos: ["topicos", "conteudo", "assunto", "topics"],
  observacoes: ["observacoes", "notas", "obs", "notes"],
};

const TIPOS: Record<string, string[]> = {
  data: ["date"],
  materia: ["select", "title", "rich_text", "status", "multi_select"],
  feito: ["checkbox", "select", "status", "rich_text"],
  topicos: ["rich_text", "select", "multi_select", "title"],
  observacoes: ["rich_text", "title"],
};

const OBRIGATORIAS = ["data", "materia", "feito"];

export type Mapeamento = Record<string, { nome: string; tipo: string }>;
export type Problema = { coluna: string; mensagem: string };

export function analisarEsquema(propriedades: Esquema): { mapeamento: Mapeamento; problemas: Problema[] } {
  const mapeamento: Mapeamento = {};
  const problemas: Problema[] = [];
  const porNome = new Map(Object.entries(propriedades).map(([nome, p]) => [normalizarTexto(nome), { nome, tipo: p.type }]));

  for (const coluna of Object.keys(NOMES)) {
    const achado = NOMES[coluna].map((n) => porNome.get(n)).find(Boolean);
    if (!achado) {
      if (OBRIGATORIAS.includes(coluna)) {
        problemas.push({ coluna, mensagem: `coluna "${coluna}" não encontrada (nomes aceitos: ${NOMES[coluna].join(", ")})` });
      }
      continue;
    }
    if (!TIPOS[coluna].includes(achado.tipo)) {
      problemas.push({ coluna, mensagem: `a coluna "${achado.nome}" é do tipo ${achado.tipo}; use ${TIPOS[coluna].join(" ou ")}` });
      continue;
    }
    mapeamento[coluna] = achado;
  }
  return { mapeamento, problemas };
}

type Rico = { plain_text?: string }[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textoDe(p: any): string {
  if (!p) return "";
  switch (p.type) {
    case "title":
      return ((p.title as Rico) ?? []).map((t) => t.plain_text ?? "").join("");
    case "rich_text":
      return ((p.rich_text as Rico) ?? []).map((t) => t.plain_text ?? "").join("");
    case "select":
      return p.select?.name ?? "";
    case "status":
      return p.status?.name ?? "";
    case "multi_select":
      return ((p.multi_select as { name: string }[]) ?? []).map((o) => o.name).join("; ");
    case "checkbox":
      return p.checkbox ? "true" : "false";
    default:
      return "";
  }
}

// "2026-10-07" fica como está; datas com horário viram o dia no fuso de São Paulo.
export function diaDoNotion(start: string | null | undefined): string | null {
  if (!start) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type LinhaBruta = {
  n: number;
  data: string;
  materia: string;
  feito: boolean;
  topicos: string;
  observacoes: string;
  chaveExterna: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function converterPagina(pagina: any, mapeamento: Mapeamento, n: number): LinhaBruta | { n: number; erro: string } {
  const prop = (coluna: string) => (mapeamento[coluna] ? pagina.properties?.[mapeamento[coluna].nome] : undefined);
  const data = diaDoNotion(prop("data")?.date?.start);
  if (!data) return { n, erro: "página sem data" };
  const feito = interpretarFeito(textoDe(prop("feito")));
  if (feito === null) return { n, erro: `valor de "feito" não reconhecido: "${textoDe(prop("feito"))}"` };
  if (typeof pagina.id !== "string") return { n, erro: "página sem id" };
  return {
    n,
    data,
    materia: textoDe(prop("materia")),
    feito,
    topicos: textoDe(prop("topicos")),
    observacoes: textoDe(prop("observacoes")),
    chaveExterna: `notion:${pagina.id}`,
  };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chamar(caminho: string, init: RequestInit = {}, tentativas = 4): Promise<any> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionErro("NOTION_TOKEN não configurado");
  for (let i = 0; i < tentativas; i++) {
    let r: Response;
    try {
      r = await fetch(BASE + caminho, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // mensagem genérica: o erro original pode carregar detalhes da requisição
      throw new NotionErro("não foi possível falar com o Notion (rede ou tempo esgotado)");
    }
    if (r.status === 429) {
      const espera = Number(r.headers.get("retry-after")) || 2 ** i;
      await dormir(Math.min(espera, 10) * 1000);
      continue;
    }
    if (r.status === 401) throw new NotionErro("token do Notion inválido", 401);
    if (r.status === 404)
      throw new NotionErro("database não encontrada. Confira o ID e se ela foi compartilhada com a integração (menu ... > Conexões)", 404);
    if (!r.ok) throw new NotionErro(`o Notion respondeu com erro ${r.status}`, r.status);
    return r.json();
  }
  throw new NotionErro("limite de requisições do Notion; tente novamente em instantes", 429);
}

function idDaDatabase(): string {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new NotionErro("NOTION_DATABASE_ID não configurado");
  return encodeURIComponent(id.replace(/-/g, ""));
}

export async function testarConexao() {
  const db = await chamar(`/databases/${idDaDatabase()}`);
  const titulo = ((db.title as Rico) ?? []).map((t) => t.plain_text ?? "").join("") || "(sem título)";
  return { titulo, ...analisarEsquema(db.properties ?? {}) };
}

export async function buscarLinhas(): Promise<{
  linhas: LinhaBruta[];
  erros: { linha: number; mensagem: string }[];
  completo: boolean;
}> {
  const { mapeamento, problemas } = await testarConexao();
  if (problemas.length) throw new NotionErro("a database não tem o formato esperado: " + problemas.map((p) => p.mensagem).join("; "));

  const linhas: LinhaBruta[] = [];
  const erros: { linha: number; mensagem: string }[] = [];
  let cursor: string | undefined;
  let completo = false;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    if (pagina > 0) await dormir(PAUSA_MS);
    const resp = await chamar(`/databases/${idDaDatabase()}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: POR_PAGINA, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    for (const p of resp.results ?? []) {
      const n = linhas.length + erros.length + 1;
      const r = converterPagina(p, mapeamento, n);
      if ("erro" in r) erros.push({ linha: r.n, mensagem: r.erro });
      else linhas.push(r);
    }
    if (!resp.has_more) {
      completo = true;
      break;
    }
    cursor = resp.next_cursor;
  }
  return { linhas, erros, completo };
}
