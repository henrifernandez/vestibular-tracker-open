import { normalizarTexto } from "./texto";

// Cor de cada matéria em um só lugar. Matérias desconhecidas usam o cinza neutro.
const CLASSES: Record<string, string> = {
  biologia: "bg-bio/10 text-bio",
  quimica: "bg-qui/10 text-qui",
  fisica: "bg-fis/10 text-fis",
};

export function classeDaMateria(materia: string): string {
  return CLASSES[normalizarTexto(materia)] ?? "bg-ink/10 text-ink/70";
}

// Cores de texto/borda para categorias do calendário. Todas passam de 4,5:1 sobre a superfície escura.
const PALETA = ["#9D83D8", "#4FA396", "#4A9CC4", "#5BB27A", "#D98A3D", "#D4699A", "#D9A82E", "#8A9792"];
const FIXAS: Record<string, string> = {
  fisica: "#9D83D8",
  matematica: "#4FA396",
  quimica: "#4A9CC4",
  biologia: "#5BB27A",
  humanas: "#D98A3D",
  linguagens: "#D4699A",
  redacao: "#D9A82E",
};

export function corDaCategoria(categoria: string): string | null {
  const n = normalizarTexto(categoria);
  if (!n) return null;
  if (FIXAS[n]) return FIXAS[n];
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

// Cores dos gráficos (a biblioteca de gráficos não lê classes do Tailwind). Mantidas iguais aos tokens.
export const GRAFICO = {
  grade: "#E8EEEB1F",
  eixo: "#E8EEEB33",
  textoEixo: "#9AA7A2",
  tooltipFundo: "#151C1A",
  tooltipBorda: "#E8EEEB26",
  meta: "#E0714A",
  resultado: "#4CC084",
} as const;
