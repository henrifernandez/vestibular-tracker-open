import { useEffect, useState } from "react";
import Link from "next/link";
import { ehRedacao } from "@/lib/redacao";
import CardRevisao from "@/components/CardRevisao";
import { notaEstimadaDaProva } from "@/lib/provas";
import { formatarDiaMes, hojeEmSaoPaulo, rotuloContagem } from "@/lib/datas";
import {
  corSensor,
  margemParaAcertos,
  margemParaNota,
  MARGEM_TRI,
  SENSOR_DOT,
  SENSOR_BAR,
  SENSOR_TEXT,
} from "@/lib/tri";

type MetaDash = { label: string; acertosAlvo: number | null; notaAlvo: number | null; observacao: string | null };

type AreaDash = {
  id: string;
  nome: string;
  peso: number;
  totalQuestoes: number;
  ehRedacao?: boolean;
  ultimaNota?: number | null;
  melhorNota?: number | null;
  ultimoAcertos: number | null;
  ultimoTotal: number | null;
  progresso: number | null;
  qtdSimulados: number;
  metas: MetaDash[];
};

type ProvaDash = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  dataProva: string | null;
  metaPercentual: number | null;
  metaNota: number | null;
  areas: AreaDash[];
};

type SimuladoResultado = {
  acertos: number;
  totalQuestoes: number;
  notaEstimada: number | null;
  area: { nome: string };
};

type SimuladoRow = {
  id: string;
  data: string;
  prova: { nome: string; slug: string };
  resultados: SimuladoResultado[];
};

type PlanoEstudoRow = { feito: boolean; syncedAt: string; materia: string };

function ChevronIcon({ aberto }: { aberto: boolean }) {
  return (
    <span
      className={
        "inline-flex text-ink/60 transition-transform duration-150 " + (aberto ? "rotate-90" : "")
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 6 15 12 9 18"></polyline>
      </svg>
    </span>
  );
}

function progressoMedio(prova: ProvaDash): number | null {
  const valores = prova.areas.map((a) => a.progresso).filter((v): v is number => v != null);
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
}

function metaAcertos(area: AreaDash): number | null {
  const valores = area.metas.map((m) => m.acertosAlvo).filter((v): v is number => v != null);
  return valores.length ? Math.max(...valores) : null;
}

function metaNota(area: AreaDash): number | null {
  const valores = area.metas.map((m) => m.notaAlvo).filter((v): v is number => v != null);
  return valores.length ? Math.max(...valores) : null;
}

// Nota estimada (TRI) só existe para provas com áreas do ENEM; para as demais retorna null.
function notaDaProva(prova: ProvaDash): number | null {
  return notaEstimadaDaProva(
    prova.areas.map((a) => ({
      nome: a.nome,
      peso: a.peso,
      acertos: a.ultimoAcertos,
      notaRedacao: a.ultimaNota ?? null,
    }))
  );
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function resumoSimulado(s: SimuladoRow): { texto: string; pct: number | null } {
  if (s.resultados.length === 0) return { texto: "sem resultados", pct: null };

  if (s.resultados.length === 1) {
    const r = s.resultados[0];
    if (ehRedacao(r.area.nome)) {
      return {
        texto: `${r.area.nome} — nota ${r.notaEstimada ?? "?"}`,
        pct: r.notaEstimada != null ? Math.round((r.notaEstimada / 1000) * 100) : null,
      };
    }
    return {
      texto: `${r.area.nome} — ${r.acertos}/${r.totalQuestoes}`,
      pct: r.totalQuestoes > 0 ? Math.round((r.acertos / r.totalQuestoes) * 100) : null,
    };
  }

  const objetivas = s.resultados.filter((r) => !ehRedacao(r.area.nome));
  const totalAcertos = objetivas.reduce((sum, r) => sum + r.acertos, 0);
  const totalQuestoes = objetivas.reduce((sum, r) => sum + r.totalQuestoes, 0);
  const pct = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : null;
  return { texto: `${s.resultados.length} áreas — média ${pct ?? "?"}%`, pct };
}

// Guia de três passos para quem acabou de instalar. Cada etapa se marca sozinha quando o dado existe,
// e o guia some quando há prova e simulado cadastrados.
function PrimeirosPassos({ provas, totalSimulados }: { provas: ProvaDash[]; totalSimulados: number }) {
  const passos = [
    {
      titulo: "Escolha a sua prova",
      texto: "ENEM, Fuvest, Unicamp ou outra: use um modelo pronto ou defina as áreas você mesmo.",
      feito: provas.length > 0,
      href: "/provas",
      acao: "Adicionar prova",
    },
    {
      titulo: "Defina a data e a meta",
      texto: "Diga quando é a prova e quanto quer acertar. O painel mostra a contagem regressiva e o que falta.",
      feito: provas.some((p) => p.dataProva && p.metaPercentual != null),
      href: "/provas",
      acao: "Definir data e meta",
    },
    {
      titulo: "Registre o primeiro simulado",
      texto: "Lance os acertos por área, ou importe um CSV. O painel passa a comparar o resultado com a sua meta.",
      feito: totalSimulados > 0,
      href: "/simulados",
      acao: "Registrar simulado",
    },
  ];
  const atual = passos.findIndex((p) => !p.feito);
  const feitos = passos.filter((p) => p.feito).length;

  return (
    <section aria-label="Primeiros passos" className="bg-surface rounded-xl border border-ink/10 p-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Comece por aqui</h2>
        <span className="font-mono text-xs text-ink/60">{feitos} de {passos.length} passos</span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {passos.map((p, i) => (
          <li
            key={p.titulo}
            aria-current={i === atual ? "step" : undefined}
            className={
              "flex flex-col gap-2 rounded-lg border p-4 " +
              (i === atual ? "border-accent/50 bg-accent/10" : "border-ink/10 bg-paper/40")
            }
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-brand">
                {p.feito ? "✓" : i + 1}
              </span>
              <h3 className="text-sm font-medium">{p.titulo}</h3>
              {p.feito && <span className="ml-auto text-xs text-brand">Feito</span>}
            </div>
            <p className="text-sm text-ink/70">{p.texto}</p>
            {i === atual && (
              <Link href={p.href} className="mt-auto inline-block self-start bg-accent text-white rounded-md px-4 py-2 text-sm font-medium">
                {p.acao}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Dashboard() {
  const [provas, setProvas] = useState<ProvaDash[] | null>(null);
  const [simulados, setSimulados] = useState<SimuladoRow[] | null>(null);
  const [plano, setPlano] = useState<PlanoEstudoRow[] | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/simulados").then((r) => r.json()),
      fetch("/api/plano").then((r) => r.json()),
    ]).then(([d, s, p]) => {
      setProvas(d);
      setSimulados(s);
      setPlano(p);
    });
  }, []);

  if (!provas || !simulados || !plano) {
    return <p className="text-sm text-ink/60">Carregando...</p>;
  }

  const hoje = hojeEmSaoPaulo();
  const proximas = provas
    .filter((p) => p.dataProva && p.dataProva.slice(0, 10) >= hoje)
    .sort((a, b) => a.dataProva!.localeCompare(b.dataProva!))
    .slice(0, 3);

  const progressos = provas.map(progressoMedio).filter((v): v is number => v != null);
  const progressoGeral = progressos.length
    ? Math.round(progressos.reduce((s, v) => s + v, 0) / progressos.length)
    : null;

  const cronogramaFeito = plano.filter((p) => p.feito).length;
  const pctCronograma = plano.length ? Math.round((cronogramaFeito / plano.length) * 100) : null;

  const ultimaAtualizacaoPlano = plano.length
    ? plano.reduce((max, p) => (p.syncedAt > max ? p.syncedAt : max), plano[0].syncedAt)
    : null;

  const simuladosRecentes = simulados.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Painel de evolução</h1>
          <p className="text-sm text-ink/60 mt-1">
            Progresso consolidado de simulados, cronograma e revisão.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 bg-surface border border-ink/10 rounded-full pl-2.5 pr-3 py-1.5 text-xs">
            <span className={"h-1.5 w-1.5 rounded-full " + (ultimaAtualizacaoPlano ? "bg-good" : "bg-brand")} />
            <span className="font-medium">Plano</span>
            <span className="font-mono text-ink/60">
              {ultimaAtualizacaoPlano ? `atualizado ${formatHora(ultimaAtualizacaoPlano)}` : "sem dados"}
            </span>
          </span>
        </div>
      </div>

      {(provas.length === 0 || simulados.length === 0) && <PrimeirosPassos provas={provas} totalSimulados={simulados.length} />}

      {/* Contagem regressiva */}
      {proximas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {proximas.map((p) => (
            <Link
              key={p.id}
              href={`/provas/${p.slug}`}
              className="bg-surface rounded-xl border border-ink/10 p-4 hover:bg-paper/60 transition"
            >
              <div className="font-mono text-[11px] uppercase tracking-wide text-ink/60">Próxima prova</div>
              <div className="font-display text-lg font-semibold mt-1 truncate">{p.nome}</div>
              <div className="font-mono text-2xl text-brand mt-1">{rotuloContagem(p.dataProva!, hoje)}</div>
              <div className="text-xs text-ink/60 mt-1">{formatarDiaMes(p.dataProva!)}</div>
            </Link>
          ))}
        </div>
      )}
      {provas.length > 0 && proximas.length === 0 && (
        <p className="text-sm text-ink/60">
          Nenhuma data de prova futura. <Link href="/provas" className="underline text-brand">Defina a data</Link> para ver a contagem regressiva.
        </p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface rounded-xl border border-ink/10 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink/60">Progresso geral</div>
          <div className="font-display text-2xl font-semibold mt-1">
            {progressoGeral != null ? `${progressoGeral}%` : "—"}
          </div>
          <div className="text-xs text-ink/60 mt-1">
            {progressoGeral != null ? `da meta, média de ${provas.length} ${provas.length === 1 ? "prova" : "provas"}` : "defina uma meta e registre um simulado"}
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-ink/10 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink/60">Simulados registrados</div>
          <div className="font-display text-2xl font-semibold mt-1">{simulados.length}</div>
          <div className="text-xs text-ink/60 mt-1">no total</div>
        </div>
        <CardRevisao />
        <div className="bg-surface rounded-xl border border-ink/10 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink/60">Cronograma cumprido</div>
          <div className="font-display text-2xl font-semibold mt-1">
            {plano.length ? `${cronogramaFeito}/${plano.length}` : "—"}
          </div>
          <div className="text-xs text-ink/60 mt-1">
            {pctCronograma != null ? `${pctCronograma}% do planejado` : "sem dados ainda"}
          </div>
        </div>
      </div>

      {/* Provas */}
      {provas.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Provas</h2>
            <span className="text-xs text-ink/60">clique em uma prova para ver o progresso por área</span>
          </div>

          <div className="space-y-2.5">
            {provas.map((prova) => {
              const aberto = abertoId === prova.id;
              const pct = progressoMedio(prova);
              const nota = notaDaProva(prova);

              // Sensor do cabeçalho: soma dos acertos contra a soma das metas das áreas objetivas.
              const objetivas = prova.areas.filter((a) => !ehRedacao(a.nome));
              const somaAcertos = objetivas.reduce((s, a) => s + (a.ultimoAcertos ?? 0), 0);
              const somaMeta = objetivas.reduce((s, a) => s + (metaAcertos(a) ?? 0), 0);
              const somaTotal = objetivas.reduce((s, a) => s + a.totalQuestoes, 0);
              const temDados = objetivas.some((a) => a.ultimoAcertos != null);
              const sensorHeader =
                temDados && somaMeta > 0 ? corSensor(somaAcertos, somaMeta, margemParaAcertos(somaTotal)) : null;
              const temMeta = prova.areas.some((a) => a.metas.length > 0);
              const sensorNota =
                nota != null && prova.metaNota != null ? corSensor(nota, prova.metaNota, MARGEM_TRI) : null;

              return (
                <div key={prova.id} className="bg-surface rounded-xl border border-ink/10 overflow-hidden">
                  <button
                    onClick={() => setAbertoId(aberto ? null : prova.id)}
                    aria-expanded={aberto}
                    className="flex items-center gap-3.5 px-5 py-3.5 w-full text-left hover:bg-paper/60 transition"
                  >
                    <ChevronIcon aberto={aberto} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium truncate">{prova.nome}</div>
                      {prova.dataProva && (
                        <div className="text-xs text-ink/60 font-mono">
                          {formatarDiaMes(prova.dataProva)} · {rotuloContagem(prova.dataProva, hoje)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-28 h-2 rounded-full bg-ink/10 overflow-hidden">
                        <div
                          className={"h-full rounded-full " + (sensorHeader ? SENSOR_BAR[sensorHeader] : "bg-accent")}
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                      <span className={"font-mono text-xs w-9 text-right " + (sensorHeader ? SENSOR_TEXT[sensorHeader] : "text-ink/60")}>
                        {pct != null ? `${pct}%` : "—"}
                      </span>
                    </div>
                  </button>
                  {aberto && (
                    <div className="px-5 pb-4 pl-[50px] space-y-3">
                      {nota != null && (
                        <div className="border border-ink/10 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">Nota estimada (TRI)</div>
                            <div className="text-[11px] text-ink/60 mt-0.5">
                              média ponderada do último resultado de cada área
                              {prova.metaNota != null ? `, meta ${prova.metaNota}` : ""}
                            </div>
                          </div>
                          <span className={"font-mono text-lg flex items-center gap-2 " + (sensorNota ? SENSOR_TEXT[sensorNota] : "text-ink")}>
                            {sensorNota && <span className={"h-2 w-2 rounded-full " + SENSOR_DOT[sensorNota]} />}
                            {nota}
                          </span>
                        </div>
                      )}
                      {!temMeta && (
                        <p className="text-xs text-ink/60">
                          Sem meta definida.{" "}
                          <Link href={`/provas/${prova.slug}`} className="underline text-brand">Defina quanto quer acertar</Link>.
                        </p>
                      )}
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {prova.areas.map((area) => {
                          const redacao = ehRedacao(area.nome);
                          const valor = redacao ? area.ultimaNota ?? null : area.ultimoAcertos;
                          const meta = redacao ? metaNota(area) : metaAcertos(area);
                          const margem = redacao && meta != null ? margemParaNota(meta) : margemParaAcertos(area.totalQuestoes);
                          const sensor = valor != null && meta != null ? corSensor(valor, meta, margem) : null;
                          return (
                            <div key={area.id} className="border border-ink/10 rounded-lg p-2.5">
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium">{area.nome}</span>
                                <span className={"text-xs flex items-center gap-1.5 " + (sensor ? SENSOR_TEXT[sensor] : "text-ink/60")}>
                                  {sensor && <span className={"h-1.5 w-1.5 rounded-full " + SENSOR_DOT[sensor]} />}
                                  {valor != null
                                    ? redacao
                                      ? `nota ${valor}`
                                      : `${valor}/${area.ultimoTotal}`
                                    : "sem dados"}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-ink/10 mt-2 overflow-hidden">
                                <div
                                  className={"h-full rounded-full " + (sensor ? SENSOR_BAR[sensor] : "bg-accent")}
                                  style={{ width: `${area.progresso ?? 0}%` }}
                                />
                              </div>
                              {meta != null && (
                                <div className="text-[11px] text-ink/60 mt-1.5">
                                  meta: {redacao ? `nota ${meta}` : `${meta}/${area.totalQuestoes} acertos`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Link href={`/provas/${prova.slug}`} className="inline-block text-sm text-brand underline">
                        Ver detalhes e editar meta
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simulados recentes */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-3">Simulados recentes</h2>
        <div className="bg-surface rounded-xl border border-ink/10 overflow-hidden">
          {simuladosRecentes.length === 0 && (
            <p className="text-sm text-ink/60 px-5 py-4">Nenhum simulado registrado ainda.</p>
          )}
          {simuladosRecentes.map((s) => {
            const { texto, pct } = resumoSimulado(s);
            const cor = pct == null ? "text-ink/60" : pct >= 60 ? "text-good" : "text-warn";
            return (
              <Link
                key={s.id}
                href={`/provas/${s.prova.slug}`}
                className="flex items-center gap-3.5 px-5 py-2.5 border-b border-ink/[0.06] last:border-b-0 hover:bg-paper/60 transition text-sm"
              >
                <span className={"h-1.5 w-1.5 rounded-full flex-shrink-0 " + (pct == null ? "bg-ink/20" : pct >= 60 ? "bg-good" : "bg-warn")} />
                <span className="font-medium w-44 flex-shrink-0 truncate">{s.prova.nome}</span>
                <span className="font-mono text-xs text-ink/60 w-14 flex-shrink-0">{formatarDiaMes(s.data)}</span>
                <span className="text-ink/70 flex-1 truncate">{texto}</span>
                <span className={"text-xs font-medium flex-shrink-0 " + cor}>
                  {pct != null ? `${pct}%` : ""}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
