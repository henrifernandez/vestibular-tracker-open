import { beforeEach, describe, expect, it } from "vitest";
import { consumirUso, reiniciarContadores } from "@/lib/limite-diario";
import { simuladoCriarSchema } from "@/lib/schemas";

beforeEach(reiniciarContadores);

describe("limite diário", () => {
  it("bloqueia depois do limite e libera no dia seguinte", () => {
    const d1 = new Date("2026-10-07T15:00:00Z");
    expect(consumirUso("x", 2, d1)).toBe(true);
    expect(consumirUso("x", 2, d1)).toBe(true);
    expect(consumirUso("x", 2, d1)).toBe(false);
    expect(consumirUso("x", 2, new Date("2026-10-08T15:00:00Z"))).toBe(true);
  });
  it("o dia vira à meia-noite de São Paulo, não de UTC", () => {
    const antes = new Date("2026-10-08T02:30:00Z"); // 23:30 de 07/10 em SP
    const depois = new Date("2026-10-08T03:30:00Z"); // 00:30 de 08/10 em SP
    expect(consumirUso("y", 1, antes)).toBe(true);
    expect(consumirUso("y", 1, antes)).toBe(false);
    expect(consumirUso("y", 1, depois)).toBe(true);
  });
});

const base = { provaId: "p1", data: "2026-10-07", resultados: [{ areaId: "a1", acertos: 10, totalQuestoes: 45 }] };

describe("schema de simulado", () => {
  it("aceita um registro válido e converte a data para o dia puro", () => {
    const r = simuladoCriarSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data.toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });
  it("aceita ISO completo usando só o dia", () => {
    expect(simuladoCriarSchema.safeParse({ ...base, data: "2026-10-07T23:30:00-03:00" }).success).toBe(true);
  });
  it("rejeita acertos maior que o total", () => {
    const r = simuladoCriarSchema.safeParse({ ...base, resultados: [{ areaId: "a1", acertos: 50, totalQuestoes: 45 }] });
    expect(r.success).toBe(false);
  });
  it("rejeita negativos, decimais e data inexistente", () => {
    expect(simuladoCriarSchema.safeParse({ ...base, resultados: [{ areaId: "a", acertos: -1, totalQuestoes: 5 }] }).success).toBe(false);
    expect(simuladoCriarSchema.safeParse({ ...base, resultados: [{ areaId: "a", acertos: 1.5, totalQuestoes: 5 }] }).success).toBe(false);
    expect(simuladoCriarSchema.safeParse({ ...base, data: "2026-02-30" }).success).toBe(false);
    expect(simuladoCriarSchema.safeParse({ ...base, data: "lixo" }).success).toBe(false);
  });
  it("exige ao menos um resultado e limita textos", () => {
    expect(simuladoCriarSchema.safeParse({ ...base, resultados: [] }).success).toBe(false);
    expect(simuladoCriarSchema.safeParse({ ...base, nome: "x".repeat(121) }).success).toBe(false);
  });
});
