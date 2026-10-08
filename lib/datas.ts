// Datas do app são "dias puros" (sem horário). No banco ficam como meia-noite UTC e
// são sempre formatadas com timeZone "UTC", para não deslocar um dia no fuso do usuário.
export const FUSO = "America/Sao_Paulo";

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

// "2026-10-07" => Date (meia-noite UTC). Retorna null para texto ou data inexistente (ex: 2026-02-30).
export function diaParaDate(dia: string): Date | null {
  const m = RE_DIA.exec(dia);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === dia ? d : null;
}

// Aceita "AAAA-MM-DD" e "DD/MM/AAAA" (formato comum em planilhas brasileiras).
export function normalizarDia(texto: string): string | null {
  const t = texto.trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : t;
  return diaParaDate(iso) ? iso : null;
}

export function dateParaDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "Hoje" no fuso de São Paulo, como "AAAA-MM-DD". O servidor roda em UTC.
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(dia: string, n: number): string {
  const d = diaParaDate(dia);
  if (!d) throw new Error(`dia inválido: ${dia}`);
  d.setUTCDate(d.getUTCDate() + n);
  return dateParaDia(d);
}

// Quantos dias faltam de `de` até `ate` (negativo se `ate` já passou). Ambos "AAAA-MM-DD".
export function diasEntre(de: string, ate: string): number {
  const a = diaParaDate(de);
  const b = diaParaDate(ate);
  if (!a || !b) throw new Error(`dia inválido: ${de} / ${ate}`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// "faltam 32 dias", "amanhã", "hoje", "há 3 dias". `dia` é um dia puro (ISO ou Date do banco).
export function rotuloContagem(dia: string | Date, hoje: string = hojeEmSaoPaulo()): string {
  const alvo = typeof dia === "string" ? dia.slice(0, 10) : dateParaDia(dia);
  const n = diasEntre(hoje, alvo);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n > 1) return `faltam ${n} dias`;
  return n === -1 ? "foi ontem" : `há ${-n} dias`;
}

// "07/10" a partir de uma data do banco ou de um ISO.
export function formatarDiaMes(valor: string | Date): string {
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function diaDaSemana(valor: string | Date): string {
  return new Date(valor).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
}
