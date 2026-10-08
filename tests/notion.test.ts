import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "./fixtures/notion-database.json";
import consulta from "./fixtures/notion-consulta.json";
import { analisarEsquema, buscarLinhas, converterPagina, diaDoNotion, testarConexao } from "@/lib/notion";
import { validarLinhas } from "@/lib/plano";

const ENV = { ...process.env };

beforeEach(() => {
  process.env.NOTION_TOKEN = "secret_token_que_nunca_deve_vazar";
  process.env.NOTION_DATABASE_ID = "abc123";
});
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});

describe("esquema da database", () => {
  it("encontra as colunas mesmo com acento e maiúsculas", () => {
    const { mapeamento, problemas } = analisarEsquema(db.properties as never);
    expect(problemas).toEqual([]);
    expect(mapeamento.materia.nome).toBe("Matéria");
    expect(mapeamento.topicos.nome).toBe("Tópicos");
  });
  it("aponta coluna ausente e tipo incompatível", () => {
    const { problemas } = analisarEsquema({ Data: { type: "rich_text" }, Matéria: { type: "select" } });
    expect(problemas.map((p) => p.coluna).sort()).toEqual(["data", "feito"]);
    expect(problemas.find((p) => p.coluna === "data")?.mensagem).toContain("rich_text");
  });
});

describe("conversão de páginas", () => {
  const { mapeamento } = analisarEsquema(db.properties as never);
  it("converte uma página completa", () => {
    const r = converterPagina(consulta.results[0], mapeamento, 1);
    expect(r).toMatchObject({ data: "2026-10-07", materia: "Biologia", feito: true, topicos: "Citologia; Membrana" });
  });
  it("data com horário às 00:30 de Brasília continua no mesmo dia", () => {
    const r = converterPagina(consulta.results[1], mapeamento, 2);
    expect(r).toMatchObject({ data: "2026-10-01", feito: false });
    expect(diaDoNotion("2026-10-01T03:30:00.000Z")).toBe("2026-10-01");
    expect(diaDoNotion("2026-10-01T02:30:00.000Z")).toBe("2026-09-30");
  });
  it("página sem data vira erro, não exceção", () => {
    expect(converterPagina(consulta.results[2], mapeamento, 3)).toEqual({ n: 3, erro: "página sem data" });
  });
});

function simularNotion(respostas: Record<string, unknown>[]) {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      const r = respostas[Math.min(i++, respostas.length - 1)] as { status?: number; corpo?: unknown };
      return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    })
  );
  return chamadas;
}

describe("chamadas à API", () => {
  it("testa a conexão enviando token e versão fixa", async () => {
    const chamadas = simularNotion([{ corpo: db }]);
    const r = await testarConexao();
    expect(r.titulo).toBe("Plano de estudo");
    expect(chamadas[0].url).toContain("/databases/abc123");
    const h = chamadas[0].init?.headers as Record<string, string>;
    expect(h["Notion-Version"]).toBe("2022-06-28");
    expect(h.Authorization).toBe("Bearer secret_token_que_nunca_deve_vazar");
  });
  it("lê a database e valida as linhas; a sem data vira erro", async () => {
    simularNotion([{ corpo: db }, { corpo: consulta }]);
    const { linhas, erros, completo } = await buscarLinhas();
    expect(completo).toBe(true);
    expect(linhas).toHaveLength(2);
    expect(erros).toHaveLength(1);
    const v = validarLinhas(linhas);
    expect(v.erros).toEqual([]);
    expect(v.linhas.map((l) => l.chaveExterna)).toEqual(["notion:aaa11111-0000-0000-0000-000000000001", "notion:bbb22222-0000-0000-0000-000000000002"]);
  });
  it("traduz 404 em mensagem útil e 401 em token inválido", async () => {
    simularNotion([{ status: 404 }]);
    await expect(testarConexao()).rejects.toThrow(/compartilhada com a integração/);
    simularNotion([{ status: 401 }]);
    await expect(testarConexao()).rejects.toThrow(/token do Notion inválido/);
  });
  it("o token não aparece em nenhuma mensagem de erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("falha com Bearer secret_token_que_nunca_deve_vazar"))));
    try {
      await testarConexao();
      expect.unreachable();
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("secret_token");
    }
  });
  it("sem token configurado não faz requisição", async () => {
    delete process.env.NOTION_TOKEN;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(testarConexao()).rejects.toThrow(/NOTION_TOKEN/);
    expect(f).not.toHaveBeenCalled();
  });
});
