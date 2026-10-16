import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { chamar } from "./helpers/http";

// Sincronização com o Notion de ponta a ponta no lado do servidor: a rota /api/plano/notion de verdade,
// o Postgres de verdade e só a API do Notion simulada (fetch). Precisa de um Postgres migrado, como rotas.test.ts.
// Cobre o que o guia docs/integracoes/notion.md promete: só leitura, não duplica, inativa o que sumiu,
// o Notion vence a marcação feita no app, e cada mensagem de erro da tabela "Problemas e soluções".
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const ID_DB = "0123456789abcdef0123456789abcdef";
const PREFIXO = "notion:testevitest-";
const MIN = 61_000;

type Linha = { id: number; data: string | null; materia: string; feito?: boolean; feitoTxt?: string; topicos?: string };
type Estado = { schema: string; linhas: Linha[]; status: number | null; pagina: number };

const SCHEMAS: Record<string, Record<string, string>> = {
  ok: { Nome: "title", Data: "date", Matéria: "select", Feito: "checkbox", Tópicos: "rich_text", Observações: "rich_text" },
  dataTexto: { Nome: "title", Data: "rich_text", Matéria: "select", Feito: "checkbox" },
  semFeito: { Nome: "title", Data: "date", Matéria: "select" },
  alt: { Nome: "title", Dia: "date", Disciplina: "select", Concluído: "checkbox", Assunto: "multi_select", Notas: "rich_text" },
  feitoTexto: { Nome: "title", Data: "date", Matéria: "select", Feito: "rich_text" },
  feitoStatus: { Nome: "title", Data: "date", Matéria: "select", Feito: "status" },
};

const rico = (t?: string) => (t ? [{ type: "text", plain_text: t }] : []);

function paginaDe(l: Linha, schema: string) {
  const m = SCHEMAS[schema];
  const col = (...nomes: string[]) => Object.keys(m).find((k) => nomes.includes(k));
  const props: Record<string, unknown> = { Nome: { type: "title", title: rico(`Aula ${l.id}`) } };
  const cData = col("Data", "Dia");
  const cMat = col("Matéria", "Disciplina");
  const cFeito = col("Feito", "Concluído");
  const cTop = col("Tópicos", "Assunto");
  if (cData) props[cData] = { type: "date", date: l.data ? { start: l.data, end: null, time_zone: null } : null };
  if (cMat) props[cMat] = { type: "select", select: { name: l.materia } };
  if (cFeito) {
    const tipo = m[cFeito];
    props[cFeito] =
      tipo === "checkbox"
        ? { type: "checkbox", checkbox: !!l.feito }
        : tipo === "status"
          ? { type: "status", status: l.feitoTxt != null ? { name: l.feitoTxt } : null }
          : { type: "rich_text", rich_text: rico(l.feitoTxt ?? (l.feito ? "true" : "false")) };
  }
  if (cTop) {
    props[cTop] =
      m[cTop] === "multi_select"
        ? { type: "multi_select", multi_select: (l.topicos ?? "").split(";").filter(Boolean).map((n) => ({ name: n.trim() })) }
        : { type: "rich_text", rich_text: rico(l.topicos) };
  }
  return { object: "page", id: `testevitest-${l.id}`, properties: props };
}

// Simulador da API do Notion (versão 2022-06-28), só com os dois endpoints que o app usa.
function simularNotion(estado: Estado) {
  const chamadas: { metodo: string; caminho: string; auth?: string; versao?: string }[] = [];
  const erro = (status: number, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ object: "error", status }), { status, headers: { "content-type": "application/json", ...headers } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      const u = new URL(url);
      chamadas.push({ metodo: init?.method ?? "GET", caminho: u.pathname, auth: h.Authorization, versao: h["Notion-Version"] });
      if (estado.status) return erro(estado.status, estado.status === 429 ? { "retry-after": "1" } : {});
      const m = u.pathname.match(/^\/v1\/databases\/([^/]+)(\/query)?$/);
      if (!m || m[1] !== ID_DB) return erro(404);
      const ok = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
      if (!m[2]) {
        const properties = Object.fromEntries(Object.entries(SCHEMAS[estado.schema]).map(([n, t]) => [n, { name: n, type: t }]));
        return ok({ object: "database", title: [{ plain_text: "Plano de estudo (teste)" }], properties });
      }
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { start_cursor?: string };
      const ini = corpo.start_cursor ? Number(corpo.start_cursor) : 0;
      const fatia = estado.linhas.slice(ini, ini + estado.pagina);
      const mais = ini + estado.pagina < estado.linhas.length;
      return ok({ results: fatia.map((l) => paginaDe(l, estado.schema)), has_more: mais, next_cursor: mais ? String(ini + estado.pagina) : null });
    })
  );
  return chamadas;
}

const aulas = (n: number, extra: (i: number) => Partial<Linha> = () => ({})): Linha[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    data: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
    materia: ["Biologia", "Química", "Física"][i % 3],
    feito: i % 2 === 0,
    topicos: `Tópico ${i + 1}; Extra`,
    ...extra(i),
  }));

d("sincronização com o Notion (rota + banco)", () => {
  const prisma = new PrismaClient();
  const ENV = { ...process.env };
  let preexistentes: string[] = [];
  let estado: Estado;
  let relogio = Date.UTC(2030, 0, 1);

  // O relógio só anda para a frente: o app guarda em memória quando foi a última sincronização.
  const avancar = (ms: number) => {
    relogio += ms;
    vi.setSystemTime(relogio);
  };
  const sincronizarAgora = async () => {
    const handler = (await import("@/pages/api/plano/notion")).default;
    return chamar(handler, { method: "POST", body: { acao: "sincronizar" } });
  };
  const sincronizar = async () => {
    avancar(MIN); // o app limita a uma sincronização por minuto
    return sincronizarAgora();
  };
  const testar = async () => {
    const handler = (await import("@/pages/api/plano/notion")).default;
    return chamar(handler, { method: "POST", body: { acao: "testar" } });
  };
  const doTeste = () => prisma.planoEstudo.findMany({ where: { chaveExterna: { startsWith: PREFIXO } }, orderBy: { data: "asc" } });
  const limpar = () => prisma.planoEstudo.deleteMany({ where: { chaveExterna: { startsWith: PREFIXO } } });

  // A sincronização inativa TODAS as linhas de origem NOTION que não vieram na leitura. Num banco que já tenha
  // dados reais do Notion, isso esconderia esses dados; por isso eles são guardados e reativados no fim.
  beforeAll(async () => {
    preexistentes = (await prisma.planoEstudo.findMany({ where: { origem: "NOTION", ativo: true, NOT: { chaveExterna: { startsWith: PREFIXO } } }, select: { id: true } })).map((x) => x.id);
    await limpar();
  });
  afterAll(async () => {
    await limpar();
    if (preexistentes.length) await prisma.planoEstudo.updateMany({ where: { id: { in: preexistentes } }, data: { ativo: true } });
    await prisma.$disconnect();
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    avancar(0);
    process.env.NOTION_TOKEN = "ntn_token_de_teste_que_nunca_deve_vazar";
    process.env.NOTION_DATABASE_ID = ID_DB;
    estado = { schema: "ok", linhas: aulas(6), status: null, pagina: 100 };
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env = { ...ENV };
    await limpar();
  });

  describe("conexão", () => {
    it("Testar conexão: envia token e versão 2022-06-28, consulta só o ID da database e não escreve nada", async () => {
      const chamadas = simularNotion(estado);
      const r = await testar();
      expect(r.status).toBe(200);
      expect(r.corpo).toMatchObject({ titulo: "Plano de estudo (teste)", ok: true, problemas: [] });
      expect(chamadas).toHaveLength(1);
      expect(chamadas[0]).toMatchObject({ metodo: "GET", caminho: `/v1/databases/${ID_DB}`, auth: "Bearer ntn_token_de_teste_que_nunca_deve_vazar", versao: "2022-06-28" });
      expect(await doTeste()).toHaveLength(0);
    });
    it("aceita o link inteiro da database no lugar do ID (ignora o ?v=)", async () => {
      process.env.NOTION_DATABASE_ID = `https://www.notion.so/meu-espaco/Plano-de-estudo-${ID_DB}?v=fedcba9876543210fedcba9876543210&pvs=4`;
      const chamadas = simularNotion(estado);
      const r = await testar();
      expect(r.corpo).toMatchObject({ ok: true });
      expect(chamadas[0].caminho).toBe(`/v1/databases/${ID_DB}`);
    });
    it("sem token ou sem ID configurado, recusa e não chama o Notion", async () => {
      delete process.env.NOTION_TOKEN;
      const chamadas = simularNotion(estado);
      const r = await testar();
      expect(r.status).toBe(400);
      expect(r.corpo).toMatchObject({ error: "integração com o Notion não configurada" });
      expect(chamadas).toHaveLength(0);
    });
    it("ID inválido: mensagem com o caminho do guia, sem chamar o Notion", async () => {
      process.env.NOTION_DATABASE_ID = "isso-nao-e-um-id";
      const chamadas = simularNotion(estado);
      const r = await testar();
      expect(r.status).toBe(502);
      expect((r.corpo as { error: string }).error).toMatch(/NOTION_DATABASE_ID inválido.*docs\/integracoes\/notion\.md/);
      expect(chamadas).toHaveLength(0);
    });
    it("GET informa se a integração está configurada (a tela mostra ou esconde o bloco)", async () => {
      const handler = (await import("@/pages/api/plano/notion")).default;
      expect((await chamar(handler, { method: "GET" })).corpo).toEqual({ configurado: true });
      delete process.env.NOTION_TOKEN;
      expect((await chamar(handler, { method: "GET" })).corpo).toEqual({ configurado: false });
    });
    it("rejeita ação desconhecida e métodos que não são GET/POST", async () => {
      const handler = (await import("@/pages/api/plano/notion")).default;
      expect((await chamar(handler, { method: "POST", body: { acao: "apagar" } })).status).toBe(400);
      expect((await chamar(handler, { method: "DELETE" })).status).toBe(405);
    });
  });

  describe("formato da database (o que o guia pede)", () => {
    it.each([
      ["dataTexto", /a coluna "Data" é do tipo rich_text; use date/],
      ["semFeito", /coluna "feito" não encontrada/],
    ])("Testar conexão lista o problema (%s) e sincronizar recusa sem gravar nada", async (schema, esperado) => {
      estado.schema = schema;
      simularNotion(estado);
      const t = await testar();
      expect(t.corpo).toMatchObject({ ok: false });
      const mensagens = (t.corpo as { problemas: { mensagem: string }[] }).problemas.map((p) => p.mensagem).join(" | ");
      expect(mensagens).toMatch(esperado);
      const r = await sincronizar();
      expect(r.status).toBe(502);
      expect((r.corpo as { error: string }).error).toMatch(/a database não tem o formato esperado/);
      expect(await doTeste()).toHaveLength(0);
    });
    it("reconhece os nomes alternativos (Dia, Disciplina, Concluído, Assunto, Notas)", async () => {
      estado.schema = "alt";
      estado.linhas = aulas(3);
      simularNotion(estado);
      expect((await testar()).corpo).toMatchObject({ ok: true });
      const r = await sincronizar();
      expect(r.corpo).toMatchObject({ sincronizados: 3 });
      const linhas = await doTeste();
      expect(linhas.map((l) => l.materia).sort()).toEqual(["Biologia", "Física", "Química"]);
      expect(linhas[0].topicos).toContain("Tópico");
    });
  });

  describe("mensagens de erro do guia (tabela Problemas e soluções)", () => {
    it.each([
      [401, 502, /token do Notion inválido/],
      [403, 502, /o Notion negou o acesso.*Capacidades/],
      [404, 502, /database não encontrada.*Conexões/],
      [400, 502, /recusou a consulta \(erro 400\).*mais de uma fonte de dados/],
      [500, 502, /o Notion respondeu com erro 500/],
    ])("erro %i do Notion vira a mensagem esperada (HTTP %i)", async (codigo, http, regex) => {
      estado.status = codigo;
      simularNotion(estado);
      const r = await testar();
      expect(r.status).toBe(http);
      expect((r.corpo as { error: string }).error).toMatch(regex);
    });
    it("429 do Notion: tenta de novo com espera e termina em 'limite de requisições'", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
      estado.status = 429;
      const chamadas = simularNotion(estado);
      const p = testar();
      await vi.runAllTimersAsync();
      const r = await p;
      expect(r.status).toBe(429);
      expect((r.corpo as { error: string }).error).toMatch(/limite de requisições do Notion/);
      expect(chamadas.length).toBeGreaterThan(1);
    });
    it("Notion fora do ar ou lento demais: 'rede ou tempo esgotado', sem vazar o token", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("timeout com Bearer ntn_token_de_teste_que_nunca_deve_vazar", "TimeoutError"))));
      const r = await testar();
      expect(r.status).toBe(502);
      expect((r.corpo as { error: string }).error).toMatch(/rede ou tempo esgotado/);
      expect(r.texto).not.toContain("ntn_token_de_teste");
    });
    it("duas sincronizações em menos de 1 minuto: a segunda recebe 'Aguarde um minuto'", async () => {
      simularNotion(estado);
      const a = await sincronizar();
      avancar(10_000);
      const b = await sincronizarAgora();
      expect(a.status).toBe(200);
      expect(b.status).toBe(429);
      expect(b.corpo).toEqual({ error: "Aguarde um minuto entre sincronizações." });
      expect((await sincronizar()).status).toBe(200);
    });
    it("uma sincronização que falha não bloqueia a próxima tentativa", async () => {
      estado.status = 500;
      simularNotion(estado);
      expect((await sincronizar()).status).toBe(502);
      estado.status = null;
      avancar(5_000); // só 5 s depois da falha
      expect((await sincronizarAgora()).status).toBe(200);
    });
  });

  describe("sincronizar", () => {
    it("grava os dias com matéria, tópicos e feito; repetir não duplica", async () => {
      simularNotion(estado);
      const r1 = await sincronizar();
      expect(r1.corpo).toMatchObject({ sincronizados: 6, inativados: 0, reconciliado: true });
      const antes = await doTeste();
      expect(antes).toHaveLength(6);
      expect(antes.every((x) => x.origem === "NOTION" && x.ativo)).toBe(true);
      expect(antes[0]).toMatchObject({ materia: "Biologia", feito: true });
      const r2 = await sincronizar();
      expect(r2.corpo).toMatchObject({ sincronizados: 6, inativados: 0 });
      const depois = await doTeste();
      expect(depois.map((x) => x.id).sort()).toEqual(antes.map((x) => x.id).sort());
    });
    it("o app só lê: todas as chamadas ao Notion são GET da database ou POST de consulta", async () => {
      const chamadas = simularNotion(estado);
      await sincronizar();
      for (const c of chamadas) {
        const leitura = (c.metodo === "GET" && c.caminho === `/v1/databases/${ID_DB}`) || (c.metodo === "POST" && c.caminho === `/v1/databases/${ID_DB}/query`);
        expect(leitura).toBe(true);
      }
    });
    it("linha editada é atualizada; linha removida no Notion fica inativa, com o histórico preservado", async () => {
      simularNotion(estado);
      await sincronizar();
      estado.linhas = aulas(6);
      estado.linhas[1].feito = true;
      estado.linhas[1].topicos = "Tópico novo";
      estado.linhas.splice(4, 1);
      const r = await sincronizar();
      expect(r.corpo).toMatchObject({ sincronizados: 5, inativados: 1, reconciliado: true });
      const todas = await doTeste();
      expect(todas).toHaveLength(6); // a removida continua no banco
      expect(todas.filter((x) => !x.ativo)).toHaveLength(1);
      expect(todas.find((x) => x.topicos === "Tópico novo")?.feito).toBe(true);
    });
    it("o Notion vence: a marcação feita no app é sobrescrita na sincronização seguinte", async () => {
      simularNotion(estado);
      await sincronizar();
      const pendente = (await doTeste()).find((x) => !x.feito)!;
      const porId = (await import("@/pages/api/plano/[id]")).default;
      expect((await chamar(porId, { method: "PATCH", query: { id: pendente.id }, body: { feito: true } })).status).toBe(200);
      expect((await prisma.planoEstudo.findUnique({ where: { id: pendente.id } }))?.feito).toBe(true);
      await sincronizar();
      expect((await prisma.planoEstudo.findUnique({ where: { id: pendente.id } }))?.feito).toBe(false);
    });
    it("lê mais de 100 linhas em páginas e sincroniza todas", async () => {
      estado.linhas = aulas(150, (i) => ({ data: `2026-11-${String((i % 28) + 1).padStart(2, "0")}` }));
      const chamadas = simularNotion(estado);
      const r = await sincronizar();
      expect(r.corpo).toMatchObject({ sincronizados: 150, reconciliado: true });
      expect(chamadas.filter((c) => c.caminho.endsWith("/query"))).toHaveLength(2);
      expect(await doTeste()).toHaveLength(150);
    });
  });

  describe("valores da coluna Feito e avisos por linha", () => {
    it("Feito como texto: sim/x contam como feito; pendente e vazio, como não feito", async () => {
      estado.schema = "feitoTexto";
      estado.linhas = [
        { id: 1, data: "2026-10-21", materia: "Física", feitoTxt: "sim" },
        { id: 2, data: "2026-10-22", materia: "Física", feitoTxt: "x" },
        { id: 3, data: "2026-10-23", materia: "Física", feitoTxt: "pendente" },
        { id: 4, data: "2026-10-24", materia: "Física", feitoTxt: "" },
      ];
      simularNotion(estado);
      await sincronizar();
      expect((await doTeste()).map((x) => x.feito)).toEqual([true, true, false, false]);
    });
    it("Feito como Status: Done e Concluído contam como feito", async () => {
      estado.schema = "feitoStatus";
      estado.linhas = [
        { id: 1, data: "2026-10-25", materia: "Física", feitoTxt: "Done" },
        { id: 2, data: "2026-10-26", materia: "Física", feitoTxt: "Concluído" },
      ];
      simularNotion(estado);
      await sincronizar();
      expect((await doTeste()).map((x) => x.feito)).toEqual([true, true]);
    });
    it("linha sem data e Feito inválido viram avisos, a válida entra e nada é inativado", async () => {
      simularNotion(estado);
      await sincronizar(); // 6 linhas ativas
      estado.schema = "feitoTexto";
      estado.linhas = [
        { id: 101, data: "2026-10-27", materia: "Física", feitoTxt: "sim" },
        { id: 102, data: null, materia: "Química", feitoTxt: "sim" },
        { id: 103, data: "2026-10-28", materia: "Química", feitoTxt: "talvez" },
      ];
      const r = await sincronizar();
      const corpo = r.corpo as { sincronizados: number; inativados: number; reconciliado: boolean; erros: { linha: number; mensagem: string }[] };
      expect(corpo.sincronizados).toBe(1);
      expect(corpo.erros.map((e) => e.mensagem)).toEqual(['página sem data', 'valor de "feito" não reconhecido: "talvez"']);
      expect(corpo.inativados).toBe(0);
      expect(corpo.reconciliado).toBe(false);
      expect((await doTeste()).filter((x) => x.ativo)).toHaveLength(6 + 1); // as 6 anteriores seguem ativas
    });
  });
});
