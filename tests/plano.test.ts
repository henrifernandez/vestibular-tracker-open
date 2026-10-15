import { describe, expect, it } from "vitest";
import { analisarCsvPlano, MAX_LINHAS_PLANO } from "@/lib/plano";
import { MODELO_CSV_PLANO, modeloCsvPlano } from "@/lib/plano-modelo";
import { neutralizarFormula } from "@/lib/csv";
import { calcularResumo, resolverPeriodo } from "@/lib/resumo";
import { diaParaDate, formatarDiaMes, hojeEmSaoPaulo, normalizarDia, somarDias } from "@/lib/datas";

describe("datas", () => {
  it("valida dias inexistentes", () => {
    expect(diaParaDate("2026-02-30")).toBeNull();
    expect(diaParaDate("2026-10-07")?.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(diaParaDate("lixo")).toBeNull();
  });
  it("aceita DD/MM/AAAA", () => {
    expect(normalizarDia("7/10/2026")).toBe("2026-10-07");
    expect(normalizarDia("31/02/2026")).toBeNull();
  });
  it("hoje em São Paulo não adianta o dia às 00:30 de Brasília", () => {
    // 01/10 00:30 em Brasília = 01/10 03:30 UTC
    expect(hojeEmSaoPaulo(new Date("2026-10-01T03:30:00Z"))).toBe("2026-10-01");
    // 30/09 23:30 em Brasília = 01/10 02:30 UTC: ainda é dia 30 em São Paulo
    expect(hojeEmSaoPaulo(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-30");
  });
  it("formata o dia puro sem deslocar para o dia anterior", () => {
    expect(formatarDiaMes(new Date("2026-10-07T00:00:00Z"))).toBe("07/10");
    expect(formatarDiaMes("2026-10-07T00:00:00.000Z")).toBe("07/10");
  });
  it("soma dias atravessando mês", () => expect(somarDias("2026-10-01", -6)).toBe("2026-09-25"));
});

describe("importação de CSV do plano", () => {
  it("aceita o modelo do README", () => {
    const r = analisarCsvPlano(MODELO_CSV_PLANO);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0]).toMatchObject({ data: "2026-03-02", materia: "Biologia", feito: true });
    expect(r.linhas[0].chaveExterna).toBe("csv:biologia:2026-03-02");
  });
  it("gera o modelo com datas a partir de hoje, sem erros", () => {
    const r = analisarCsvPlano(modeloCsvPlano("2026-10-14"));
    expect(r.erros).toEqual([]);
    expect(r.linhas.map((l) => l.data)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16"]);
  });
  it("aceita ponto e vírgula, BOM, datas brasileiras e feito em português", () => {
    const csv = "﻿data;materia;feito\r\n07/10/2026;Química;sim\r\n08/10/2026;Química;não\r\n";
    const r = analisarCsvPlano(csv);
    expect(r.erros).toEqual([]);
    expect(r.linhas.map((l) => [l.data, l.feito])).toEqual([
      ["2026-10-07", true],
      ["2026-10-08", false],
    ]);
  });
  it("reporta erros por linha sem derrubar as válidas", () => {
    const csv = "data,materia,feito\n2026-10-07,Bio,true\n2026-13-45,Bio,true\n2026-10-09,,false\n2026-10-10,Bio,talvez\n";
    const r = analisarCsvPlano(csv);
    expect(r.linhas).toHaveLength(1);
    expect(r.erros.map((e) => e.linha)).toEqual([3, 4, 5]);
  });
  it("exige as colunas obrigatórias", () => {
    const r = analisarCsvPlano("data,materia\n2026-10-07,Bio\n");
    expect(r.linhas).toEqual([]);
    expect(r.erros[0].mensagem).toContain("feito");
  });
  it("é idempotente: o mesmo arquivo gera as mesmas chaves", () => {
    const a = analisarCsvPlano(MODELO_CSV_PLANO).linhas.map((l) => l.chaveExterna);
    const b = analisarCsvPlano(MODELO_CSV_PLANO).linhas.map((l) => l.chaveExterna);
    expect(a).toEqual(b);
  });
  it("várias linhas da mesma matéria no mesmo dia ganham ordinal, e acrescentar linhas não muda as chaves antigas", () => {
    const um = analisarCsvPlano("data,materia,feito,topicos\n2026-10-07,Bio,false,Células\n");
    const dois = analisarCsvPlano("data,materia,feito,topicos\n2026-10-07,Bio,false,Células\n2026-10-07,Bio,false,Genética\n");
    expect(dois.erros).toEqual([]);
    expect(dois.linhas.map((l) => l.chaveExterna)).toEqual(["csv:bio:2026-10-07", "csv:bio:2026-10-07:2"]);
    expect(um.linhas[0].chaveExterna).toBe(dois.linhas[0].chaveExterna);
  });
  it("editar o tópico não muda a chave", () => {
    const a = analisarCsvPlano("data,materia,feito,topicos\n2026-10-07,Bio,false,Células\n");
    const b = analisarCsvPlano("data,materia,feito,topicos\n2026-10-07,Bio,false,Células e organelas\n");
    expect(a.linhas[0].chaveExterna).toBe(b.linhas[0].chaveExterna);
  });
  it("rejeita linha totalmente duplicada", () => {
    const r = analisarCsvPlano("data,materia,feito,topicos\n2026-10-07,Bio,false,A\n2026-10-07,Bio,false,A\n");
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toHaveLength(1);
  });
  it("recusa arquivo com linhas demais", () => {
    const corpo = Array.from({ length: MAX_LINHAS_PLANO + 1 }, (_, i) => `2026-10-07,Bio${i},false`).join("\n");
    const r = analisarCsvPlano(`data,materia,feito\n${corpo}`);
    expect(r.linhas).toEqual([]);
    expect(r.erros[0].mensagem).toContain("máximo");
  });
  it("limita o tamanho dos campos", () => {
    const r = analisarCsvPlano(`data,materia,feito,topicos\n2026-10-07,Bio,false,${"x".repeat(501)}\n`);
    expect(r.linhas).toEqual([]);
    expect(r.erros).toHaveLength(1);
  });
});

describe("neutralizarFormula", () => {
  it("prefixa células perigosas", () => {
    expect(neutralizarFormula('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(neutralizarFormula("+1")).toBe("'+1");
    expect(neutralizarFormula("-1")).toBe("'-1");
    expect(neutralizarFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizarFormula("Texto normal")).toBe("Texto normal");
  });
});

describe("resumo semanal", () => {
  const plano = [
    { materia: "Bio", data: new Date("2026-10-05T00:00:00Z"), feito: true },
    { materia: "Bio", data: new Date("2026-10-06T00:00:00Z"), feito: false },
    { materia: "Qui", data: new Date("2026-10-06T00:00:00Z"), feito: true },
    { materia: "Qui", data: new Date("2026-09-01T00:00:00Z"), feito: true },
  ];
  const simulados = [
    { id: "a", nome: "Simulado 1", data: new Date("2026-10-04T00:00:00Z"), resumo: "30/45" },
    { id: "b", nome: "Antigo", data: new Date("2026-08-01T00:00:00Z") },
  ];
  it("conta só o período e agrupa por matéria", () => {
    const r = calcularResumo(plano, simulados, { inicio: "2026-10-01", fim: "2026-10-07" });
    expect(r.porMateria).toEqual([
      { materia: "Bio", diasPlanejados: 2, diasFeitos: 1 },
      { materia: "Qui", diasPlanejados: 1, diasFeitos: 1 },
    ]);
    expect(r.simulados.map((s) => s.id)).toEqual(["a"]);
  });
  it("período padrão são 7 dias terminando hoje em São Paulo", () => {
    expect(resolverPeriodo(undefined, undefined, new Date("2026-10-08T01:00:00Z"))).toEqual({
      inicio: "2026-10-01",
      fim: "2026-10-07",
    });
  });
  it("rejeita datas inválidas e início depois do fim", () => {
    expect(resolverPeriodo("lixo", "2026-10-07")).toBeNull();
    expect(resolverPeriodo("2026-10-10", "2026-10-07")).toBeNull();
    expect(resolverPeriodo(undefined, "2026-99-99")).toBeNull();
  });
});
