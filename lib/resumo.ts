import { dateParaDia, diaParaDate, hojeEmSaoPaulo, somarDias } from "./datas";

export type PlanoItem = { materia: string; data: Date | string; feito: boolean };
export type SimuladoItem = { id: string; nome: string; data: Date | string; resumo?: string | null };

export type ResumoMateria = { materia: string; diasPlanejados: number; diasFeitos: number };

export type ResumoSemanal = {
  periodo: { inicio: string; fim: string };
  porMateria: ResumoMateria[];
  simulados: { id: string; nome: string; data: string; resumo: string | null }[];
};

export type Periodo = { inicio: string; fim: string };

// Padrão: os 7 dias terminando hoje (em São Paulo). Retorna null se inicio/fim forem inválidos.
export function resolverPeriodo(inicio?: string, fim?: string, agora: Date = new Date()): Periodo | null {
  const f = fim ?? hojeEmSaoPaulo(agora);
  if (!diaParaDate(f)) return null;
  const i = inicio ?? somarDias(f, -6);
  if (!diaParaDate(i) || i > f) return null;
  return { inicio: i, fim: f };
}

const dia = (v: Date | string) => (typeof v === "string" ? v.slice(0, 10) : dateParaDia(v));

export function calcularResumo(plano: PlanoItem[], simulados: SimuladoItem[], periodo: Periodo): ResumoSemanal {
  const noPeriodo = (v: Date | string) => dia(v) >= periodo.inicio && dia(v) <= periodo.fim;

  const porMateria = new Map<string, ResumoMateria>();
  for (const p of plano.filter((p) => noPeriodo(p.data))) {
    const m = porMateria.get(p.materia) ?? { materia: p.materia, diasPlanejados: 0, diasFeitos: 0 };
    m.diasPlanejados += 1;
    if (p.feito) m.diasFeitos += 1;
    porMateria.set(p.materia, m);
  }

  return {
    periodo,
    porMateria: [...porMateria.values()].sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR")),
    simulados: simulados
      .filter((s) => noPeriodo(s.data))
      .sort((a, b) => dia(a.data).localeCompare(dia(b.data)))
      .map((s) => ({ id: s.id, nome: s.nome, data: dia(s.data), resumo: s.resumo ?? null })),
  };
}
