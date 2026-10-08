import { createHash } from "node:crypto";
import { z } from "zod";
import { detectarSeparador, parseCSV } from "./csv";
import { FUSO, diaParaDate, normalizarDia, somarDias } from "./datas";
import { normalizarTexto } from "./texto";

export const MAX_EVENTOS = 2000;
export const MAX_DIAS_EVENTO_LONGO = 31;

export const eventoSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser AAAA-MM-DD"),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "início deve ser HH:MM").optional().nullable(),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "fim deve ser HH:MM").optional().nullable(),
  titulo: z.string().trim().min(1, "título obrigatório").max(120, "título com mais de 120 caracteres"),
  categoria: z.string().trim().max(40, "categoria com mais de 40 caracteres").optional().nullable(),
  tipo: z.enum(["BLOCO", "PROVA"]).default("BLOCO"),
  descricao: z.string().trim().max(2000, "descrição com mais de 2000 caracteres").optional().nullable(),
})
.refine((e) => !e.fim || (e.inicio && e.fim >= e.inicio), { message: "fim deve ser depois do início", path: ["fim"] });

export type EventoEntrada = z.infer<typeof eventoSchema>;
export type EventoComChave = EventoEntrada & { chave: string; origem: "CSV" | "ICS" | "MANUAL" };
export type ErroEvento = { linha: number; mensagem: string };
export type ResultadoImportacao = { eventos: EventoComChave[]; erros: ErroEvento[]; avisos: string[]; total: number };

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);

export function chaveManual(e: EventoEntrada): string {
  return `manual:${e.dia}:${e.inicio ?? ""}:${hash(normalizarTexto(e.titulo))}`;
}

function finalizar(
  brutos: { n: number; dados: unknown; chave?: string }[],
  origem: "CSV" | "ICS"
): { eventos: EventoComChave[]; erros: ErroEvento[] } {
  const eventos: EventoComChave[] = [];
  const erros: ErroEvento[] = [];
  const vistas = new Set<string>();
  for (const b of brutos) {
    const r = eventoSchema.safeParse(b.dados);
    if (!r.success) {
      erros.push({ linha: b.n, mensagem: r.error.issues.map((i) => i.message).join("; ") });
      continue;
    }
    const e = r.data;
    const chave = b.chave ?? `csv:${e.dia}:${e.inicio ?? ""}:${hash(normalizarTexto(e.titulo))}`;
    if (vistas.has(chave)) {
      erros.push({ linha: b.n, mensagem: "evento duplicado no arquivo" });
      continue;
    }
    vistas.add(chave);
    eventos.push({ ...e, chave, origem });
  }
  return { eventos, erros };
}

export function analisarCsvCalendario(texto: string): ResultadoImportacao {
  const registros = parseCSV(texto, detectarSeparador(texto));
  if (registros.length === 0) return { eventos: [], erros: [{ linha: 1, mensagem: "arquivo vazio" }], avisos: [], total: 0 };

  const cab = registros[0].map((c) => normalizarTexto(c));
  const idx = (nome: string) => cab.indexOf(nome);
  const ausentes = ["data", "titulo"].filter((c) => idx(c) === -1);
  if (ausentes.length) {
    return { eventos: [], erros: [{ linha: 1, mensagem: `colunas obrigatórias ausentes: ${ausentes.join(", ")}` }], avisos: [], total: 0 };
  }
  const dados = registros.slice(1);
  if (dados.length > MAX_EVENTOS) {
    return { eventos: [], erros: [{ linha: 1, mensagem: `máximo de ${MAX_EVENTOS} eventos por importação` }], avisos: [], total: dados.length };
  }

  const errosLeitura: ErroEvento[] = [];
  const brutos: { n: number; dados: unknown }[] = [];
  dados.forEach((campos, i) => {
    const n = i + 2;
    const pegar = (c: string) => (idx(c) >= 0 ? (campos[idx(c)] ?? "").trim() : "");
    const dia = normalizarDia(pegar("data"));
    if (!dia) return void errosLeitura.push({ linha: n, mensagem: `data inválida: "${pegar("data")}"` });
    const tipo = normalizarTexto(pegar("tipo")) === "prova" ? "PROVA" : "BLOCO";
    brutos.push({
      n,
      dados: {
        dia,
        inicio: pegar("inicio") || null,
        fim: pegar("fim") || null,
        titulo: pegar("titulo"),
        categoria: pegar("categoria") || null,
        tipo,
        descricao: pegar("descricao") || null,
      },
    });
  });

  const { eventos, erros } = finalizar(brutos, "CSV");
  return { eventos, erros: [...errosLeitura, ...erros].sort((a, b) => a.linha - b.linha), avisos: [], total: dados.length };
}

// ---------- .ics (RFC 5545), somente o necessário para eventos simples ----------

function desdobrar(texto: string): string[] {
  // linhas dobradas continuam com espaço ou tab no início da seguinte
  return texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

export function desescaparIcs(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function deslocamentoMs(instante: number, fuso: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - instante;
}

function instanteDaParede(a: number, mes: number, d: number, h: number, mi: number, fuso: string): number {
  const chute = Date.UTC(a, mes - 1, d, h, mi);
  let r = chute - deslocamentoMs(chute, fuso);
  r = chute - deslocamentoMs(r, fuso);
  return r;
}

function fusoValido(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type DataIcs = { dia: string; hora: string | null };

// Converte DTSTART/DTEND para dia e hora no horário de Brasília.
export function lerDataIcs(chave: string, valor: string): DataIcs | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valor.trim());
  if (!m) return null;
  const [, a, mes, d, hh, mm, , z] = m;
  if (!diaParaDate(`${a}-${mes}-${d}`)) return null; // ex: 20260230
  if (hh === undefined) return { dia: `${a}-${mes}-${d}`, hora: null }; // dia inteiro
  const tzid = /TZID=([^;:]+)/i.exec(chave)?.[1];
  let instante: number;
  if (z) instante = Date.UTC(+a, +mes - 1, +d, +hh, +mm);
  else if (tzid && fusoValido(tzid)) instante = instanteDaParede(+a, +mes, +d, +hh, +mm, tzid);
  else instante = instanteDaParede(+a, +mes, +d, +hh, +mm, FUSO); // horário flutuante: assume Brasília
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instante));
  const g = (t: string) => partes.find((x) => x.type === t)!.value;
  return { dia: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour")}:${g("minute")}` };
}

export function analisarIcs(texto: string): ResultadoImportacao {
  const linhas = desdobrar(texto);
  if (!linhas.some((l) => l.trim() === "BEGIN:VCALENDAR")) {
    return { eventos: [], erros: [{ linha: 1, mensagem: "não parece um arquivo .ics (falta BEGIN:VCALENDAR)" }], avisos: [], total: 0 };
  }

  const brutos: { n: number; dados: unknown; chave: string }[] = [];
  const errosLeitura: ErroEvento[] = [];
  let recorrentes = 0;
  let total = 0;
  let atual: Record<string, { params: string; valor: string }> | null = null;
  let numero = 0;

  for (const linha of linhas) {
    numero++;
    if (linha.trim() === "BEGIN:VEVENT") {
      atual = {};
      continue;
    }
    if (linha.trim() === "END:VEVENT" && atual) {
      total++;
      const ev = atual;
      atual = null;
      if (total > MAX_EVENTOS) continue;
      if (ev.RRULE) recorrentes++;
      if (ev.UID && ev.UID.valor.length > 200) {
        errosLeitura.push({ linha: numero, mensagem: "UID longo demais" });
        continue;
      }
      const ini = ev.DTSTART ? lerDataIcs(ev.DTSTART.params, ev.DTSTART.valor) : null;
      if (!ini) {
        errosLeitura.push({ linha: numero, mensagem: "evento sem data de início válida" });
        continue;
      }
      const fim = ev.DTEND ? lerDataIcs(ev.DTEND.params, ev.DTEND.valor) : null;
      const tituloBruto = desescaparIcs(ev.SUMMARY?.valor ?? "").trim() || "(sem título)";
      // "[prova] Fuvest" no título do evento marca uma data de prova (contagem regressiva)
      const ehProva = tituloBruto.toLowerCase().startsWith("[prova]");
      const titulo = (ehProva ? tituloBruto.slice(7).trim() : tituloBruto) || tituloBruto;
      const tipo = ehProva ? "PROVA" : "BLOCO";
      const descricao = ev.DESCRIPTION ? desescaparIcs(ev.DESCRIPTION.valor).trim() : null;
      const uid = ev.UID?.valor ?? `${ini.dia}${ini.hora}${titulo}`;

      // Evento de dia inteiro: DTEND é exclusivo. Vira um evento por dia, até o limite.
      if (ini.hora === null) {
        const ultimo = fim && fim.dia > ini.dia ? somarDias(fim.dia, -1) : ini.dia;
        for (let dia = ini.dia, i = 0; dia <= ultimo && i < MAX_DIAS_EVENTO_LONGO; dia = somarDias(dia, 1), i++) {
          brutos.push({ n: numero, chave: `ics:${uid}:${dia}`, dados: { dia, inicio: null, fim: null, titulo, categoria: null, tipo, descricao } });
        }
        continue;
      }
      brutos.push({
        n: numero,
        chave: `ics:${uid}:${ini.dia}`,
        dados: { dia: ini.dia, inicio: ini.hora, fim: fim && fim.dia === ini.dia ? fim.hora : null, titulo, categoria: null, tipo, descricao },
      });
      continue;
    }
    if (!atual) continue;
    const dois = linha.indexOf(":");
    if (dois < 0) continue;
    const nomeComParams = linha.slice(0, dois);
    const nome = nomeComParams.split(";")[0].toUpperCase();
    if (["DTSTART", "DTEND", "SUMMARY", "DESCRIPTION", "UID", "RRULE"].includes(nome) && !atual[nome]) {
      atual[nome] = { params: nomeComParams, valor: linha.slice(dois + 1) };
    }
  }

  const avisos: string[] = [];
  if (total > MAX_EVENTOS) {
    return { eventos: [], erros: [{ linha: 1, mensagem: `máximo de ${MAX_EVENTOS} eventos por importação` }], avisos, total };
  }
  if (recorrentes > 0) {
    avisos.push(`${recorrentes} evento(s) recorrente(s): só a primeira ocorrência foi importada.`);
  }
  if (brutos.length > MAX_EVENTOS) {
    return { eventos: [], erros: [{ linha: 1, mensagem: `máximo de ${MAX_EVENTOS} eventos por importação (contando os dias de eventos longos)` }], avisos, total };
  }
  const { eventos, erros } = finalizar(brutos, "ICS");
  return { eventos, erros: [...errosLeitura, ...erros], avisos, total };
}
