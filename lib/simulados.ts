export type ResultadoInput = {
  areaId: string;
  acertos: number;
  totalQuestoes: number;
  notaEstimada?: number | null;
  textoRedacao?: string | null;
  avaliacaoIA?: unknown;
  conteudosErrados?: string[];
};

// Monta o `create` aninhado do Prisma para os resultados de um simulado.
export function montarResultadosCreate(resultados: ResultadoInput[]) {
  return resultados.map((r) => ({
    areaId: r.areaId,
    acertos: r.acertos,
    totalQuestoes: r.totalQuestoes,
    notaEstimada: r.notaEstimada ?? undefined,
    textoRedacao: r.textoRedacao ?? undefined,
    avaliacaoIA: (r.avaliacaoIA ?? undefined) as any,
    conteudosErrados: {
      create: (r.conteudosErrados || [])
        .map((c) => c.trim())
        .filter(Boolean)
        .map((conteudo) => ({ conteudo })),
    },
  }));
}
