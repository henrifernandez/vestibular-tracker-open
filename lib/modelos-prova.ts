// Modelos prontos para cadastrar uma prova com um clique. São só um ponto de partida:
// o formulário deixa mudar nome, áreas e número de questões. Confira o edital do ano,
// porque os formatos mudam.
export type AreaModelo = { nome: string; totalQuestoes: number; peso?: number };

export type ModeloProva = {
  id: string;
  nome: string;
  descricao: string;
  areas: AreaModelo[];
};

export const MODELOS_PROVA: ModeloProva[] = [
  {
    id: "enem",
    nome: "ENEM",
    descricao: "Quatro provas objetivas de 45 questões e a redação (nota de 0 a 1000).",
    areas: [
      { nome: "Linguagens", totalQuestoes: 45 },
      { nome: "Ciências Humanas", totalQuestoes: 45 },
      { nome: "Ciências da Natureza", totalQuestoes: 45 },
      { nome: "Matemática", totalQuestoes: 45 },
      { nome: "Redação", totalQuestoes: 1 },
    ],
  },
  {
    id: "fuvest",
    nome: "Fuvest (1ª fase)",
    descricao: "Prova objetiva única de 90 questões.",
    areas: [{ nome: "Prova objetiva", totalQuestoes: 90 }],
  },
  {
    id: "unicamp",
    nome: "Unicamp (1ª fase)",
    descricao: "Prova objetiva única de 72 questões.",
    areas: [{ nome: "Prova objetiva", totalQuestoes: 72 }],
  },
  {
    id: "personalizada",
    nome: "Outra prova (você define as áreas)",
    descricao: "Para qualquer vestibular, concurso ou prova da escola.",
    areas: [{ nome: "Prova objetiva", totalQuestoes: 50 }],
  },
];

export function modeloPorId(id: string): ModeloProva | undefined {
  return MODELOS_PROVA.find((m) => m.id === id);
}
