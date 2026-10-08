import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { chamar } from "./helpers/http";

// Testes de integração: precisam de um Postgres migrado (veja docker-compose.yml e o README).
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const MATERIA = "TesteVitest";
const CSV = `data,materia,feito,topicos\n2026-10-07,${MATERIA},true,Tópico A\n2026-10-08,${MATERIA},false,Tópico B\n`;

d("rotas com banco real", () => {
  const prisma = new PrismaClient();

  async function limpar() {
    await prisma.planoEstudo.deleteMany({ where: { materia: MATERIA } });
    await prisma.eventoCalendario.deleteMany({ where: { titulo: { startsWith: "TesteVitest" } } });
    await prisma.prova.deleteMany({ where: { nome: { startsWith: "TesteVitest" } } });
  }

  // Cria uma prova de teste direto pela rota, como a interface faz.
  async function criarProva(corpo: Record<string, unknown>) {
    const provas = (await import("@/pages/api/provas/index")).default;
    return chamar(provas, { method: "POST", body: corpo });
  }
  beforeAll(limpar);
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it("plano: prévia não grava; importar grava; importar de novo não duplica", async () => {
    const importar = (await import("@/pages/api/plano/importar")).default;
    const previa = await chamar(importar, { method: "POST", body: { csv: CSV } });
    expect(previa.status).toBe(200);
    expect(await prisma.planoEstudo.count({ where: { materia: MATERIA } })).toBe(0);

    const r1 = await chamar(importar, { method: "POST", body: { csv: CSV, confirmar: true } });
    expect(r1.corpo).toMatchObject({ criados: 2, atualizados: 0 });
    const r2 = await chamar(importar, { method: "POST", body: { csv: CSV, confirmar: true } });
    expect(r2.corpo).toMatchObject({ criados: 0, atualizados: 2 });
    expect(await prisma.planoEstudo.count({ where: { materia: MATERIA } })).toBe(2);

    const linha = await prisma.planoEstudo.findFirst({ where: { materia: MATERIA }, orderBy: { data: "asc" } });
    expect(linha?.data.toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("plano: CSV sem linhas válidas retorna 400 e corpo inválido também", async () => {
    const importar = (await import("@/pages/api/plano/importar")).default;
    const ruim = await chamar(importar, { method: "POST", body: { csv: "data,materia,feito\nlixo,x,y\n", confirmar: true } });
    expect(ruim.status).toBe(400);
    expect((await chamar(importar, { method: "POST", body: {} })).status).toBe(400);
    expect((await chamar(importar, { method: "GET" })).status).toBe(405);
  });

  it("resumo semanal: conta o período e rejeita datas inválidas com 400", async () => {
    const resumo = (await import("@/pages/api/resumo-semanal")).default;
    const ok = await chamar(resumo, { query: { inicio: "2026-10-07", fim: "2026-10-08" } });
    expect(ok.status).toBe(200);
    const m = (ok.corpo as { porMateria: { materia: string; diasPlanejados: number; diasFeitos: number }[] }).porMateria.find((x) => x.materia === MATERIA);
    expect(m).toEqual({ materia: MATERIA, diasPlanejados: 2, diasFeitos: 1 });
    expect((await chamar(resumo, { query: { inicio: "lixo" } })).status).toBe(400);
    expect((await chamar(resumo, { query: { inicio: "2026-10-09", fim: "2026-10-01" } })).status).toBe(400);
  });

  it("calendário: importa .ics e é idempotente", async () => {
    const importar = (await import("@/pages/api/calendario/importar")).default;
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:vitest-1\r\nDTSTART:20261007T210000Z\r\nDTEND:20261007T230000Z\r\nSUMMARY:TesteVitest aula\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const a = await chamar(importar, { method: "POST", body: { formato: "ics", conteudo: ics, confirmar: true } });
    expect(a.corpo).toMatchObject({ criados: 1 });
    const b = await chamar(importar, { method: "POST", body: { formato: "ics", conteudo: ics, confirmar: true } });
    expect(b.corpo).toMatchObject({ criados: 0, atualizados: 1 });
    const ev = await prisma.eventoCalendario.findFirst({ where: { titulo: "TesteVitest aula" } });
    expect(ev).toMatchObject({ inicio: "18:00", fim: "20:00" });
  });

  it("simulados: dados inválidos retornam 400 com a lista de erros, sem detalhes internos", async () => {
    const simulados = (await import("@/pages/api/simulados/index")).default;
    const r = await chamar(simulados, {
      method: "POST",
      body: { provaId: "x", data: "2026-02-30", resultados: [{ areaId: "a", acertos: 50, totalQuestoes: 45 }] },
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.corpo)).not.toMatch(/prisma|invocation/i);
    expect((r.corpo as { detalhes: string[] }).detalhes.length).toBeGreaterThanOrEqual(2);
  });

  it("simulados: excluir um id inexistente retorna 404 genérico", async () => {
    const porId = (await import("@/pages/api/simulados/[id]/index")).default;
    const r = await chamar(porId, { method: "DELETE", query: { id: "nao-existe" } });
    expect(r.status).toBe(404);
    expect(r.texto).not.toMatch(/prisma/i);
  });

  it("provas: criar com meta em porcentagem gera metas por área e slug único", async () => {
    const corpo = {
      nome: "TesteVitest ENEM",
      dataProva: "2026-11-08",
      metaPercentual: 70,
      areas: [
        { nome: "Matemática", totalQuestoes: 45 },
        { nome: "Redação", totalQuestoes: 1 },
      ],
    };
    const a = await criarProva(corpo);
    expect(a.status).toBe(201);
    const criada = a.corpo as { slug: string; dataProva: string; areas: { nome: string; metas: { acertosAlvo: number | null; notaAlvo: number | null }[] }[] };
    expect(criada.slug).toMatch(/^testevitest-enem/);
    expect(criada.dataProva).toBe("2026-11-08T00:00:00.000Z");
    expect(criada.areas[0].metas[0]).toMatchObject({ acertosAlvo: 32, notaAlvo: null });
    expect(criada.areas[1].metas[0]).toMatchObject({ acertosAlvo: null, notaAlvo: 700 });

    const b = await criarProva(corpo);
    expect(b.status).toBe(201);
    expect((b.corpo as { slug: string }).slug).not.toBe(criada.slug);
  });

  it("provas: dados inválidos retornam 400 com a lista de erros", async () => {
    const r = await criarProva({ nome: "", areas: [{ nome: "A", totalQuestoes: 0 }] });
    expect(r.status).toBe(400);
    expect((r.corpo as { detalhes: string[] }).detalhes.length).toBeGreaterThanOrEqual(2);
    const repetida = await criarProva({ nome: "TesteVitest X", areas: [{ nome: "A", totalQuestoes: 5 }, { nome: "a", totalQuestoes: 5 }] });
    expect(repetida.status).toBe(400);
  });

  it("provas: editar data, meta e meta de uma área; remover a meta", async () => {
    const criada = (await criarProva({ nome: "TesteVitest Edicao", areas: [{ nome: "Geral", totalQuestoes: 50 }] })).corpo as { slug: string; areas: { id: string }[] };
    const porSlug = (await import("@/pages/api/provas/[slug]")).default;
    const ler = async () => (await chamar(porSlug, { query: { slug: criada.slug } })).corpo as { dataProva: string | null; metaPercentual: number | null; areas: { metas: { acertosAlvo: number | null }[] }[] };

    expect((await chamar(porSlug, { method: "PATCH", query: { slug: criada.slug }, body: { dataProva: "2026-12-01", metaPercentual: 80 } })).status).toBe(200);
    let p = await ler();
    expect(p.dataProva).toBe("2026-12-01T00:00:00.000Z");
    expect(p.areas[0].metas.map((m) => m.acertosAlvo)).toEqual([40]);

    await chamar(porSlug, { method: "PATCH", query: { slug: criada.slug }, body: { areas: [{ id: criada.areas[0].id, acertosAlvo: 44 }] } });
    p = await ler();
    expect(p.metaPercentual).toBe(80);
    expect(p.areas[0].metas.map((m) => m.acertosAlvo)).toEqual([44]);

    await chamar(porSlug, { method: "PATCH", query: { slug: criada.slug }, body: { dataProva: null, metaPercentual: null } });
    p = await ler();
    expect(p.dataProva).toBeNull();
    expect(p.areas[0].metas).toEqual([]);
  });

  it("provas: área de outra prova, prova inexistente e data inválida", async () => {
    const porSlug = (await import("@/pages/api/provas/[slug]")).default;
    const a = (await criarProva({ nome: "TesteVitest A", areas: [{ nome: "Geral", totalQuestoes: 10 }] })).corpo as { slug: string };
    const b = (await criarProva({ nome: "TesteVitest B", areas: [{ nome: "Geral", totalQuestoes: 10 }] })).corpo as { areas: { id: string }[] };
    const alheia = await chamar(porSlug, { method: "PATCH", query: { slug: a.slug }, body: { areas: [{ id: b.areas[0].id, acertosAlvo: 5 }] } });
    expect(alheia.status).toBe(400);
    expect((await chamar(porSlug, { method: "PATCH", query: { slug: "nao-existe-xyz" }, body: { nome: "x" } })).status).toBe(404);
    expect((await chamar(porSlug, { method: "PATCH", query: { slug: a.slug }, body: { dataProva: "2026-02-30" } })).status).toBe(400);
  });

  it("provas: excluir apaga a prova e os simulados dela", async () => {
    const porSlug = (await import("@/pages/api/provas/[slug]")).default;
    const criada = (await criarProva({ nome: "TesteVitest Excluir", areas: [{ nome: "Geral", totalQuestoes: 10 }] })).corpo as { id: string; slug: string; areas: { id: string }[] };
    const simulados = (await import("@/pages/api/simulados/index")).default;
    const s = await chamar(simulados, { method: "POST", body: { provaId: criada.id, data: "2026-10-07", resultados: [{ areaId: criada.areas[0].id, acertos: 7, totalQuestoes: 10 }] } });
    expect(s.status).toBe(201);
    expect((await chamar(porSlug, { method: "DELETE", query: { slug: criada.slug } })).status).toBe(204);
    expect(await prisma.simulado.count({ where: { provaId: criada.id } })).toBe(0);
    expect((await chamar(porSlug, { query: { slug: criada.slug } })).status).toBe(404);
  });

  it("simulados: área que não pertence à prova é rejeitada", async () => {
    const simulados = (await import("@/pages/api/simulados/index")).default;
    const a = (await criarProva({ nome: "TesteVitest S1", areas: [{ nome: "Geral", totalQuestoes: 10 }] })).corpo as { id: string };
    const b = (await criarProva({ nome: "TesteVitest S2", areas: [{ nome: "Geral", totalQuestoes: 10 }] })).corpo as { areas: { id: string }[] };
    const r = await chamar(simulados, { method: "POST", body: { provaId: a.id, data: "2026-10-07", resultados: [{ areaId: b.areas[0].id, acertos: 1, totalQuestoes: 10 }] } });
    expect(r.status).toBe(400);
  });

  it("exportação CSV neutraliza fórmulas", async () => {
    await criarProva({ nome: "TesteVitest Exporta", areas: [{ nome: "Geral", totalQuestoes: 10 }] });
    const prova = await prisma.prova.findFirstOrThrow({ where: { nome: "TesteVitest Exporta" }, include: { areas: true } });
    const sim = await prisma.simulado.create({
      data: {
        provaId: prova.id,
        data: new Date("2026-10-07T00:00:00Z"),
        nome: '=HYPERLINK("http://x","clique")',
        resultados: { create: [{ areaId: prova.areas[0].id, acertos: 1, totalQuestoes: 2 }] },
      },
    });
    try {
      const exportar = (await import("@/pages/api/simulados/[id]/export")).default;
      const r = await chamar(exportar, { query: { id: sim.id } });
      expect(r.status).toBe(200);
      expect(r.texto).toContain(`'=HYPERLINK`);
      expect(r.texto).not.toMatch(/(^|,)"?=HYPERLINK/m);
    } finally {
      await prisma.simulado.delete({ where: { id: sim.id } });
    }
  });

  it("importação de simulados por CSV é idempotente e rejeita células vazias e áreas repetidas", async () => {
    const importar = (await import("@/pages/api/simulados/import")).default;
    await criarProva({ nome: "TesteVitest Importa", areas: [{ nome: "Geral", totalQuestoes: 10 }] });
    const prova = await prisma.prova.findFirstOrThrow({ where: { nome: "TesteVitest Importa" }, include: { areas: true } });
    const area = prova.areas[0].nome;
    const cab = "Prova,Simulado,Data,Área,Acertos,Total de questões,% de acertos,Conteúdos errados";
    const linha = (acertos: string) => [prova.nome, "TesteVitest import", "2026-10-07", area, acertos, "10", "", ""].join(",");
    const csv = [cab, linha("7")].join("\n");
    try {
      const a = await chamar(importar, { method: "POST", body: { csv } });
      expect(a.corpo).toMatchObject({ simuladosCriados: 1 });
      const b = await chamar(importar, { method: "POST", body: { csv } });
      expect(b.corpo).toMatchObject({ simuladosCriados: 0, simuladosJaExistentes: 1 });
      const vazio = await chamar(importar, { method: "POST", body: { csv: [cab, linha("")].join("\n") } });
      expect((vazio.corpo as { erros: string[] }).erros.length).toBe(1);
      const rep = await chamar(importar, { method: "POST", body: { csv: [cab, linha("1").replace("TesteVitest import", "TesteVitest rep"), linha("2").replace("TesteVitest import", "TesteVitest rep")].join("\n") } });
      expect((rep.corpo as { erros: string[] }).erros.some((e) => e.includes("repetida"))).toBe(true);
      expect((await chamar(importar, { method: "POST", body: undefined })).status).toBe(400);
    } finally {
      await prisma.simulado.deleteMany({ where: { nome: { startsWith: "TesteVitest" } } });
    }
  });
});
