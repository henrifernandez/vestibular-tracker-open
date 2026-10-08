import { describe, expect, it } from "vitest";
import { MODELOS_PROVA, modeloPorId } from "@/lib/modelos-prova";
import { metaDaArea, notaEstimadaDaProva, slugificar, slugUnico, temAreaComTri } from "@/lib/provas";
import { provaAtualizarSchema, provaCriarSchema } from "@/lib/provas-schemas";
import { diasEntre, rotuloContagem } from "@/lib/datas";
import { margemParaAcertos } from "@/lib/tri";

describe("modelos de prova", () => {
  it("todos passam na validação de criação", () => {
    for (const m of MODELOS_PROVA) {
      const r = provaCriarSchema.safeParse({ nome: m.nome, areas: m.areas });
      expect(r.success, m.id).toBe(true);
    }
  });
  it("ids são únicos e a busca por id funciona", () => {
    expect(new Set(MODELOS_PROVA.map((m) => m.id)).size).toBe(MODELOS_PROVA.length);
    expect(modeloPorId("enem")?.areas).toHaveLength(5);
    expect(modeloPorId("nao-existe")).toBeUndefined();
  });
});

describe("slug", () => {
  it("remove acento e símbolos", () => {
    expect(slugificar("ENEM 2026")).toBe("enem-2026");
    expect(slugificar("  Fuvest (1ª fase) — Computação! ")).toBe("fuvest-1-fase-computacao");
    expect(slugificar("???")).toBe("prova");
  });
  it("não passa de 40 caracteres e não termina em hífen", () => {
    const s = slugificar("a".repeat(39) + " b");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("acrescenta sufixo quando já existe", () => {
    expect(slugUnico("ENEM", new Set())).toBe("enem");
    expect(slugUnico("ENEM", new Set(["enem"]))).toBe("enem-2");
    expect(slugUnico("ENEM", new Set(["enem", "enem-2"]))).toBe("enem-3");
  });
});

describe("meta por porcentagem", () => {
  it("objetiva arredonda para cima", () => {
    expect(metaDaArea({ nome: "Matemática", totalQuestoes: 45 }, 70)).toEqual({ acertosAlvo: 32, notaAlvo: null });
    expect(metaDaArea({ nome: "Prova objetiva", totalQuestoes: 90 }, 100)).toEqual({ acertosAlvo: 90, notaAlvo: null });
  });
  it("redação vira nota de 0 a 1000", () => {
    expect(metaDaArea({ nome: "Redação", totalQuestoes: 1 }, 70)).toEqual({ acertosAlvo: null, notaAlvo: 700 });
  });
});

describe("nota estimada", () => {
  type Linha = { nome: string; peso: number; acertos: number | null; notaRedacao: number | null };
  const enem = (acertos: number, redacao: number | null): Linha[] => [
    ...["Matemática", "Linguagens", "Ciências Humanas", "Ciências da Natureza"].map((nome) => ({ nome, peso: 1, acertos, notaRedacao: null })),
    { nome: "Redação", peso: 1, acertos: null, notaRedacao: redacao },
  ];

  it("é nula quando a prova não tem áreas do ENEM", () => {
    expect(notaEstimadaDaProva([{ nome: "Prova objetiva", peso: 1, acertos: 60, notaRedacao: null }])).toBeNull();
    expect(temAreaComTri(["Prova objetiva"])).toBe(false);
    expect(temAreaComTri(["Redação", "Matemática"])).toBe(true);
  });
  it("só redação não conta como prova com TRI", () => {
    expect(notaEstimadaDaProva([{ nome: "Redação", peso: 1, acertos: null, notaRedacao: 900 }])).toBeNull();
  });
  it("calcula a média e respeita áreas sem resultado", () => {
    expect(notaEstimadaDaProva(enem(45, 1000))).toBeGreaterThan(notaEstimadaDaProva(enem(20, 600))!);
    const parcial = notaEstimadaDaProva([
      { nome: "Matemática", peso: 1, acertos: 45, notaRedacao: null },
      { nome: "Linguagens", peso: 1, acertos: null, notaRedacao: null },
    ]);
    expect(parcial).toBe(980);
  });
  it("o peso desloca a média", () => {
    const iguais = notaEstimadaDaProva([
      { nome: "Matemática", peso: 1, acertos: 45, notaRedacao: null },
      { nome: "Linguagens", peso: 1, acertos: 10, notaRedacao: null },
    ])!;
    const pesada = notaEstimadaDaProva([
      { nome: "Matemática", peso: 3, acertos: 45, notaRedacao: null },
      { nome: "Linguagens", peso: 1, acertos: 10, notaRedacao: null },
    ])!;
    expect(pesada).toBeGreaterThan(iguais);
  });
});

describe("validação", () => {
  const base = { nome: "Minha prova", areas: [{ nome: "Geral", totalQuestoes: 50 }] };
  it("rejeita nome vazio, sem áreas e questões inválidas", () => {
    expect(provaCriarSchema.safeParse({ ...base, nome: "  " }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, areas: [] }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, areas: [{ nome: "A", totalQuestoes: 0 }] }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, areas: [{ nome: "A", totalQuestoes: 2.5 }] }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, areas: [{ nome: "A", totalQuestoes: 301 }] }).success).toBe(false);
  });
  it("rejeita nomes de área repetidos (ignorando acento e caixa)", () => {
    const r = provaCriarSchema.safeParse({
      ...base,
      areas: [
        { nome: "Matemática", totalQuestoes: 10 },
        { nome: "matematica", totalQuestoes: 10 },
      ],
    });
    expect(r.success).toBe(false);
  });
  it("limita áreas, meta e data", () => {
    const muitas = Array.from({ length: 13 }, (_, i) => ({ nome: `A${i}`, totalQuestoes: 5 }));
    expect(provaCriarSchema.safeParse({ ...base, areas: muitas }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, metaPercentual: 0 }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, metaPercentual: 101 }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, dataProva: "2026-02-30" }).success).toBe(false);
    expect(provaCriarSchema.safeParse({ ...base, dataProva: "2026-11-08", metaPercentual: 80 }).success).toBe(true);
  });
  it("na edição, ausente mantém e null apaga", () => {
    const a = provaAtualizarSchema.parse({});
    expect(a.dataProva).toBeUndefined();
    expect(a.metaPercentual).toBeUndefined();
    const b = provaAtualizarSchema.parse({ dataProva: null, metaPercentual: null });
    expect(b.dataProva).toBeNull();
    expect(b.metaPercentual).toBeNull();
  });
});

describe("contagem regressiva", () => {
  it("conta dias entre datas", () => {
    expect(diasEntre("2026-10-11", "2026-11-08")).toBe(28);
    expect(diasEntre("2026-11-08", "2026-10-11")).toBe(-28);
    expect(diasEntre("2026-03-01", "2026-03-01")).toBe(0);
  });
  it("monta o rótulo", () => {
    const hoje = "2026-10-11";
    expect(rotuloContagem("2026-10-11", hoje)).toBe("hoje");
    expect(rotuloContagem("2026-10-12", hoje)).toBe("amanhã");
    expect(rotuloContagem("2026-11-08", hoje)).toBe("faltam 28 dias");
    expect(rotuloContagem("2026-10-10", hoje)).toBe("foi ontem");
    expect(rotuloContagem("2026-10-08", hoje)).toBe("há 3 dias");
    expect(rotuloContagem(new Date("2026-11-08T00:00:00Z"), hoje)).toBe("faltam 28 dias");
  });
});

describe("margem da régua", () => {
  it("é proporcional ao total, com mínimo de 1", () => {
    expect(margemParaAcertos(45)).toBe(4);
    expect(margemParaAcertos(90)).toBe(8);
    expect(margemParaAcertos(5)).toBe(1);
  });
});
