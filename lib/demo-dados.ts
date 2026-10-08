// Gera simulados FICTÍCIOS com evolução crescente, para a demonstração e as capturas de tela.
// Determinístico (mesma semente, mesmos números) e sem nenhum dado real.
import type { PrismaClient } from "@prisma/client";
import { MARCA_FICTICIO } from "./revisao";
import { diaParaDate, somarDias } from "./datas";
import { ehRedacao } from "./redacao";

export { MARCA_FICTICIO };

const ASSUNTOS: Record<string, string[]> = {
  Matemática: ["Análise combinatória", "Probabilidade", "Logaritmos", "Geometria espacial", "Porcentagem e juros", "Funções do 2º grau", "Trigonometria", "Estatística"],
  "Ciências da Natureza": ["Cinemática", "Genética", "Estequiometria", "Eletrodinâmica", "Ecologia", "Termoquímica", "Óptica", "Química orgânica"],
  "Ciências Humanas": ["Revolução Industrial", "Cartografia", "Brasil República", "Urbanização", "Filosofia política", "Questão ambiental"],
  Linguagens: ["Gêneros textuais", "Figuras de linguagem", "Interpretação de charge", "Variação linguística", "Funções da linguagem", "Coesão e coerência"],
  "Prova objetiva": ["Probabilidade", "Genética", "Cinemática", "Brasil República", "Estequiometria", "Gêneros textuais", "Geometria analítica", "Ecologia"],
};

// Gerador pseudoaleatório simples (mulberry32): mesma semente, mesma sequência.
function aleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ProvaComAreas = { id: string; areas: { id: string; nome: string; totalQuestoes: number }[] };

// Cria `quantidade` simulados quinzenais terminando em `fim`, com a taxa de acerto subindo de
// `de` a `ate` (frações de 0 a 1) e um pouco de ruído.
export async function criarSimuladosFicticios(
  prisma: PrismaClient,
  prova: ProvaComAreas,
  opcoes: { quantidade: number; fim: string; de: number; ate: number; semente: number; prefixo: string }
): Promise<number> {
  const rnd = aleatorio(opcoes.semente);
  for (let i = 0; i < opcoes.quantidade; i++) {
    const dia = somarDias(opcoes.fim, -14 * (opcoes.quantidade - 1 - i));
    const progresso = opcoes.quantidade > 1 ? i / (opcoes.quantidade - 1) : 1;
    const base = opcoes.de + (opcoes.ate - opcoes.de) * progresso;

    const resultados = prova.areas.map((area) => {
      if (ehRedacao(area.nome)) {
        const nota = Math.round((base * 1000 + (rnd() - 0.5) * 80) / 20) * 20;
        return { areaId: area.id, acertos: 1, totalQuestoes: 1, notaEstimada: Math.max(0, Math.min(1000, nota)), conteudosErrados: { create: [] } };
      }
      const taxa = Math.max(0, Math.min(1, base + (rnd() - 0.5) * 0.12));
      const acertos = Math.round(area.totalQuestoes * taxa);
      const pool = ASSUNTOS[area.nome] ?? ASSUNTOS["Prova objetiva"];
      const quantosErros = Math.min(pool.length, Math.max(0, Math.round((1 - taxa) * 6)));
      const erros = [...pool].sort(() => rnd() - 0.5).slice(0, quantosErros);
      return {
        areaId: area.id,
        acertos,
        totalQuestoes: area.totalQuestoes,
        conteudosErrados: { create: erros.map((conteudo) => ({ conteudo })) },
      };
    });

    await prisma.simulado.create({
      data: {
        provaId: prova.id,
        data: diaParaDate(dia)!,
        nome: `${opcoes.prefixo} ${String(i + 1).padStart(2, "0")}`,
        observacao: MARCA_FICTICIO,
        resultados: { create: resultados },
      },
    });
  }
  return opcoes.quantidade;
}

export function hojeMais(hoje: string, dias: number): Date {
  return diaParaDate(somarDias(hoje, dias))!;
}
