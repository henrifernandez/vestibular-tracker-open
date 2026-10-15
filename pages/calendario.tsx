import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import ImportarCalendario from "@/components/ImportarCalendario";
import { corDaCategoria } from "@/lib/cores";
import { diaParaDate, hojeEmSaoPaulo, somarDias } from "@/lib/datas";

type Evento = {
  id: string;
  dia: string;
  inicio: string | null;
  fim: string | null;
  titulo: string;
  categoria: string;
  tipo: "BLOCO" | "PROVA";
  descricao: string | null;
};

type SimuladoApi = {
  id: string;
  nome: string | null;
  data: string;
  prova: { nome: string };
  resultados: { acertos: number; totalQuestoes: number }[];
};

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MAX_SEMANAS = 26;

const ms = (iso: string) => diaParaDate(iso)!.getTime();
const diasEntre = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86400000);
const hm = (s: string) => {
  const [h, m] = s.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
};
const segunda = (iso: string) => {
  const d = diaParaDate(iso)!.getUTCDay();
  return somarDias(iso, -((d + 6) % 7));
};

export default function Calendario() {
  const [hoje, setHoje] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [simulados, setSimulados] = useState<SimuladoApi[]>([]);
  const [erro, setErro] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  const carregar = useCallback(() => {
    setErro(false);
    fetch("/api/calendario")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEventos(d.map((e: Evento) => ({ ...e, dia: e.dia.slice(0, 10) }))))
      .catch(() => setErro(true));
    fetch("/api/simulados")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setSimulados(d))
      .catch(() => {});
  }, []);

  useEffect(() => setHoje(hojeEmSaoPaulo()), []);
  useEffect(carregar, [carregar]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos ?? []) m.set(e.dia, [...(m.get(e.dia) ?? []), e]);
    return m;
  }, [eventos]);

  const simuladosPorDia = useMemo(() => {
    const m = new Map<string, SimuladoApi[]>();
    for (const s of simulados) m.set(s.data.slice(0, 10), [...(m.get(s.data.slice(0, 10)) ?? []), s]);
    return m;
  }, [simulados]);

  const categorias = useMemo(
    () => Array.from(new Set((eventos ?? []).filter((e) => e.tipo === "BLOCO" && e.categoria).map((e) => e.categoria))).sort(),
    [eventos]
  );

  const provas = useMemo(() => (eventos ?? []).filter((e) => e.tipo === "PROVA"), [eventos]);
  const proximasProvas = hoje ? provas.filter((p) => p.dia >= hoje).slice(0, 5) : [];

  const semanas = useMemo(() => {
    if (!eventos || eventos.length === 0 || !hoje) return [];
    const primeiro = eventos[0].dia < hoje ? eventos[0].dia : hoje;
    const ultimo = eventos[eventos.length - 1].dia;
    const lista: string[] = [];
    for (let s = segunda(primeiro); s <= ultimo && lista.length < MAX_SEMANAS; s = somarDias(s, 7)) lista.push(s);
    return lista;
  }, [eventos, hoje]);

  function alternar<T>(conj: Set<T>, valor: T, set: (s: Set<T>) => void) {
    const novo = new Set(conj);
    if (novo.has(valor)) novo.delete(valor);
    else novo.add(valor);
    set(novo);
  }

  async function remover(id: string) {
    if (!window.confirm("Remover este evento?")) return;
    await fetch(`/api/calendario?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    carregar();
  }

  return (
    <div className="space-y-6">
      <Head>
        <title>Calendário | Vestibular Tracker</title>
      </Head>
      <div>
        <h1 className="font-display text-2xl font-semibold">Calendário de estudos</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">
          Importe seu calendário (.ics ou CSV). Eventos do tipo prova entram na contagem regressiva, e os simulados
          registrados aparecem no dia em que foram feitos.
        </p>
      </div>

      {erro && <p className="text-sm text-warn">Não foi possível carregar o calendário.</p>}
      <ImportarCalendario aoImportar={carregar} desativado={DEMO} />

      {proximasProvas.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Contagem das provas">
          {proximasProvas.map((p) => {
            const dias = diasEntre(hoje!, p.dia);
            return (
              <div key={p.id} className="rounded-lg border border-ink/10 bg-surface p-3">
                <div className="text-3xl font-semibold tabular-nums leading-none">{dias === 0 ? "hoje" : dias}</div>
                <div className="mt-1 text-xs text-ink/60">{dias === 0 ? "" : dias === 1 ? "dia" : "dias"}</div>
                <div className="mt-2 text-sm font-medium">{p.titulo}</div>
                <div className="text-xs text-ink/60">
                  {p.dia.slice(8)}/{p.dia.slice(5, 7)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => {
            const ativo = !ocultas.has(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternar(ocultas, c, setOcultas)}
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition " +
                  (ativo ? "border-ink/20 bg-surface text-ink" : "border-transparent text-ink/60 line-through hover:text-ink")
                }
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDaCategoria(c) ?? "#8A9792" }} />
                {c}
              </button>
            );
          })}
        </div>
      )}

      {eventos && eventos.length === 0 && (
        <p className="rounded-xl border border-ink/10 bg-surface p-4 text-sm text-ink/60">
          {DEMO ? "Nenhum evento no calendário." : "Nenhum evento ainda. Importe um arquivo acima para começar."}
        </p>
      )}

      {semanas.map((inicio) => {
        const fimSemana = somarDias(inicio, 6);
        return (
          <section key={inicio} className="space-y-2">
            <h2 className="font-display text-lg font-semibold">
              {Number(inicio.slice(8))} {MESES[Number(inicio.slice(5, 7)) - 1]} a {Number(fimSemana.slice(8))}{" "}
              {MESES[Number(fimSemana.slice(5, 7)) - 1]}
            </h2>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)).map((dia) => {
                const itens = porDia.get(dia) ?? [];
                const provasDia = itens.filter((e) => e.tipo === "PROVA");
                const blocos = itens.filter((e) => e.tipo === "BLOCO" && !ocultas.has(e.categoria));
                const reais = simuladosPorDia.get(dia) ?? [];
                const aberto = abertos.has(dia);
                const d = diaParaDate(dia)!;
                const fimDeSemana = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                const proxima = provas.find((p) => p.dia >= dia) ?? null;
                const faltam = proxima ? diasEntre(dia, proxima.dia) : null;

                return (
                  <article
                    key={dia}
                    className={
                      "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-surface p-2 " +
                      (provasDia.length ? "border-ink " : "border-ink/10 ") +
                      (fimDeSemana ? "bg-ink/[0.03] " : "") +
                      (hoje && dia < hoje ? "bg-ink/[0.02] " : "") +
                      (dia === hoje ? "ring-2 ring-brand" : "")
                    }
                  >
                    <div className="flex items-start justify-between gap-1">
                      <button
                        type="button"
                        aria-expanded={aberto}
                        title="Mostrar detalhes do dia"
                        onClick={() => alternar(abertos, dia, setAbertos)}
                        className="flex min-w-0 items-baseline gap-2 text-left text-xs text-ink/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <b className="text-xl font-semibold tabular-nums text-ink">{Number(dia.slice(8))}</b>
                        <span>{DIAS[d.getUTCDay()]}</span>
                        {(dia === inicio || dia.endsWith("-01")) && (
                          <span className="uppercase tracking-wider">{MESES[Number(dia.slice(5, 7)) - 1]}</span>
                        )}
                      </button>
                      {faltam !== null && (
                        <span
                          title={`Faltam ${faltam} dias para ${proxima!.titulo}`}
                          className={
                            "shrink-0 rounded px-1.5 py-0.5 tabular-nums text-[10.5px] " +
                            (faltam === 0 ? "bg-ink font-medium text-paper" : "bg-ink/10 text-ink/70")
                          }
                        >
                          {faltam === 0 ? "Dia D" : "D-" + faltam}
                        </span>
                      )}
                    </div>

                    {provasDia.map((e) => (
                      <div key={e.id} className="rounded bg-ink px-2 py-1 text-xs font-medium text-paper">
                        {e.titulo}
                      </div>
                    ))}
                    {reais.map((s) => {
                      const acertos = s.resultados.reduce((a, r) => a + r.acertos, 0);
                      const total = s.resultados.reduce((a, r) => a + r.totalQuestoes, 0);
                      return (
                        <div key={s.id} className="rounded border border-good/40 bg-good/10 px-2 py-1 text-xs">
                          <span className="block text-[10px] uppercase tracking-wider text-good">Registrado</span>
                          {s.nome || s.prova.nome}, {acertos}/{total}
                        </div>
                      );
                    })}
                    {blocos.map((e) => {
                      const cor = corDaCategoria(e.categoria);
                      return (
                        <div
                          key={e.id}
                          className={"rounded px-2 py-1 text-xs leading-snug " + (cor ? "" : "border border-dotted border-ink/30 text-ink/70")}
                          style={cor ? { borderLeft: `3px solid ${cor}`, backgroundColor: `${cor}1F` } : undefined}
                        >
                          <span className="block tabular-nums text-[10.5px] text-ink/60">
                            {e.inicio ? (e.fim ? `${hm(e.inicio)} a ${hm(e.fim)}` : hm(e.inicio)) : "dia todo"}
                          </span>
                          {e.titulo}
                          {aberto && e.descricao && <span className="mt-1 block text-[11.5px] text-ink/60">{e.descricao}</span>}
                          {aberto && !DEMO && (
                            <button type="button" onClick={() => remover(e.id)} className="mt-1 text-[11px] text-warn underline">
                              Remover
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!provasDia.length && !blocos.length && !reais.length && <div className="text-xs text-ink/60">Sem eventos</div>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
