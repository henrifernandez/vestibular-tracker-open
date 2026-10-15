import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import ImportarPlano from "@/components/ImportarPlano";
import SincronizarNotion from "@/components/SincronizarNotion";
import { classeDaMateria } from "@/lib/cores";
import { formatarDiaMes, diaDaSemana, hojeEmSaoPaulo } from "@/lib/datas";

type ResumoMateria = {
  materia: string;
  diasPlanejados: number;
  diasFeitos: number;
};

type Resumo = {
  periodo: { inicio: string; fim: string };
  porMateria: ResumoMateria[];
  simulados: { id: string; nome: string; data: string; resumo: string | null }[];
};

type PlanoDia = {
  id: string;
  materia: string;
  data: string;
  topicos: string | null;
  feito: boolean;
  observacoes: string | null;
};

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function ResumoSemanal() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [plano, setPlano] = useState<PlanoDia[] | null>(null);
  const [erro, setErro] = useState(false);
  const [filtroMateria, setFiltroMateria] = useState<string>("Todas");
  const [soPendentes, setSoPendentes] = useState(false);

  const carregar = useCallback(() => {
    setErro(false);
    Promise.all([
      fetch("/api/resumo-semanal").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/plano").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([r, p]) => {
        setResumo(r);
        setPlano(p);
      })
      .catch(() => setErro(true));
  }, []);

  useEffect(carregar, [carregar]);

  const materias = useMemo(() => ["Todas", ...Array.from(new Set((plano ?? []).map((p) => p.materia))).sort()], [plano]);

  const listaFiltrada = useMemo(() => {
    if (!plano) return [];
    return plano
      .filter((p) => filtroMateria === "Todas" || p.materia === filtroMateria)
      .filter((p) => !soPendentes || !p.feito)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [plano, filtroMateria, soPendentes]);

  const totais = useMemo(() => {
    if (!plano) return null;
    const total = plano.length;
    const feitos = plano.filter((p) => p.feito).length;
    return { total, feitos, pct: total ? Math.round((feitos / total) * 100) : 0 };
  }, [plano]);

  const hoje = hojeEmSaoPaulo();

  return (
    <div className="space-y-8">
      <Head>
        <title>Resumo semanal | Monitor de Acertos</title>
      </Head>
      <div>
        <h1 className="font-display text-2xl font-semibold">Resumo semanal</h1>
        <p className="text-sm text-ink/60 mt-1">
          Cronograma planejado comparado com as aulas concluídas e os simulados da semana.
        </p>
      </div>

      {erro && <p className="text-sm text-warn">Não foi possível carregar o resumo.</p>}

      <ImportarPlano aoImportar={carregar} desativado={DEMO} />
      {!DEMO && <SincronizarNotion aoSincronizar={carregar} />}

      {!resumo || !plano || !totais ? (
        !erro && <p className="text-sm text-ink/60">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-surface rounded-xl border border-ink/10 p-4">
              <p className="text-xs uppercase tracking-wide text-ink/60 mb-1">Dias no cronograma</p>
              <p className="font-display text-3xl font-semibold">{totais.total}</p>
            </div>
            <div className="bg-surface rounded-xl border border-ink/10 p-4">
              <p className="text-xs uppercase tracking-wide text-ink/60 mb-1">Já estudados</p>
              <p className="font-display text-3xl font-semibold">
                {totais.feitos} <span className="text-base font-sans font-normal text-ink/60">de {totais.total}</span>
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-ink/10 p-4">
              <p className="text-xs uppercase tracking-wide text-ink/60 mb-1">Progresso geral</p>
              <p className="font-display text-3xl font-semibold">{totais.pct}%</p>
            </div>
          </div>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-ink/60 mb-3">
              Últimos 7 dias ({formatarDiaMes(resumo.periodo.inicio)} a {formatarDiaMes(resumo.periodo.fim)})
            </h2>
            {resumo.porMateria.length === 0 ? (
              <p className="text-sm text-ink/60 bg-surface rounded-xl border border-ink/10 p-4">
                Nenhum dia do plano nesse período.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {resumo.porMateria.map((m) => (
                  <div key={m.materia} className="bg-surface rounded-xl border border-ink/10 p-4">
                    <p className="font-medium text-sm mb-2">{m.materia}</p>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-ink/60">Aulas feitas</span>
                      <span className="font-mono font-medium">
                        {m.diasFeitos}/{m.diasPlanejados} dias
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-ink/60 mb-3">Simulados da semana</h2>
            {resumo.simulados.length === 0 ? (
              <p className="text-sm text-ink/60 bg-surface rounded-xl border border-ink/10 p-4">
                Nenhum simulado registrado nesse período.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {resumo.simulados.map((s) => (
                  <li
                    key={s.id}
                    className="bg-surface rounded-lg border border-ink/10 px-3.5 py-2.5 flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-ink/60 mr-2">{formatarDiaMes(s.data)}</span>
                      {s.nome}
                    </span>
                    <span className="font-mono text-xs text-ink/60 whitespace-nowrap">{s.resumo ?? "sem resultados"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h2 className="text-xs uppercase tracking-wide text-ink/60 mr-2">Cronograma completo</h2>
              {materias.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={filtroMateria === m}
                  onClick={() => setFiltroMateria(m)}
                  className={
                    "text-xs px-3 py-1.5 rounded-full border transition " +
                    (filtroMateria === m
                      ? "bg-accent text-white border-accent"
                      : "border-ink/15 text-ink/60 hover:border-accent/50 hover:text-brand")
                  }
                >
                  {m}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1.5 text-xs text-ink/60">
                <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
                Só pendentes
              </label>
            </div>

            <div className="space-y-1.5">
              {listaFiltrada.length === 0 && (
                <p className="text-sm text-ink/60 text-center py-8">
                  {plano.length === 0 ? "Nenhum plano importado ainda." : "Nenhum dia com esse filtro."}
                </p>
              )}
              {listaFiltrada.map((item) => {
                const chipClass = classeDaMateria(item.materia);
                const topicos = (item.topicos ?? "").split(";").map((t) => t.trim()).filter(Boolean);
                const passado = item.data.slice(0, 10) < hoje;
                return (
                  <div
                    key={item.id}
                    className="bg-surface rounded-lg border border-ink/10 px-3.5 py-2.5 grid grid-cols-[56px_1fr_auto] gap-3 items-start"
                  >
                    <div className="font-mono text-xs text-ink/60 pt-0.5">
                      {formatarDiaMes(item.data)}
                      <div className="text-[10px] text-ink/60">{diaDaSemana(item.data)}</div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink/70 mb-1">{item.materia}</p>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {topicos.map((t) => (
                          <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${chipClass}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-ink/60 line-clamp-2">{item.observacoes}</p>
                    </div>
                    <span
                      className={
                        "text-[11px] px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap " +
                        (item.feito ? "bg-good/10 text-good" : passado ? "bg-warn/10 text-warn" : "bg-ink/5 text-ink/60")
                      }
                    >
                      {item.feito ? "Feito" : passado ? "Atrasado" : "Pendente"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
