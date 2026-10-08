import { normalizarTexto } from "./texto";
import { ehRedacao } from "./redacao";
import { estimarTRI, mediaPonderada } from "./tri";

export const MAX_PROVAS = 30;
export const MAX_AREAS = 12;

// "ENEM 2026" => "enem-2026". Sem acento, só letras, números e hífen.
export function slugificar(nome: string): string {
  const base = normalizarTexto(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "prova";
}

export function slugUnico(nome: string, existentes: Set<string>): string {
  const base = slugificar(nome);
  if (!existentes.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-${n}`;
    if (!existentes.has(candidato)) return candidato;
  }
  return `${base}-${Date.now()}`;
}

// A meta da prova é um percentual ("quero acertar 70%"). Para cada área vira:
// - objetiva: número de acertos, arredondado para cima (70% de 45 = 32 acertos);
// - redação: nota de 0 a 1000 (70% = 700).
export function metaDaArea(area: { nome: string; totalQuestoes: number }, percentual: number): { acertosAlvo: number | null; notaAlvo: number | null } {
  if (ehRedacao(area.nome)) return { acertosAlvo: null, notaAlvo: percentual * 10 };
  return { acertosAlvo: Math.ceil((area.totalQuestoes * percentual) / 100), notaAlvo: null };
}

export type AreaParaNota = {
  nome: string;
  peso: number;
  acertos: number | null; // resultado considerado (o último da área)
  notaRedacao: number | null;
};

// Nota estimada da prova: média ponderada (pelo peso de cada área) da nota TRI estimada
// das áreas do ENEM, mais a nota da redação quando houver. Retorna null se a prova não tem
// nenhuma área com curva TRI (ex: uma prova de 90 questões únicas), porque aplicar a curva
// do ENEM a outra prova não teria fundamento.
export function notaEstimadaDaProva(areas: AreaParaNota[]): number | null {
  const valores: Record<string, number | null> = {};
  const pesos: Record<string, number> = {};
  let temTri = false;
  for (const a of areas) {
    pesos[a.nome] = a.peso;
    if (ehRedacao(a.nome)) {
      valores[a.nome] = a.notaRedacao;
      continue;
    }
    if (estimarTRI(a.nome, 0) != null) temTri = true;
    valores[a.nome] = a.acertos != null ? estimarTRI(a.nome, a.acertos) : null;
  }
  if (!temTri) return null;
  return mediaPonderada(valores, pesos);
}

// A prova tem alguma área com curva TRI (só as quatro objetivas do ENEM têm)?
export function temAreaComTri(nomesDasAreas: string[]): boolean {
  return nomesDasAreas.some((n) => !ehRedacao(n) && estimarTRI(n, 0) != null);
}
