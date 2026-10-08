import { ehRedacao } from "@/lib/redacao";
import { metaDaArea } from "@/lib/provas";

type AreaMeta = { nome: string; totalQuestoes: number };

// Uma pergunta só: "quanto quero acertar?". O app converte a porcentagem em acertos por área
// (e em nota, na redação) e mostra o resultado antes de salvar.
export default function MetaPercentual({
  valor,
  onChange,
  areas,
  desativado = false,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  areas: AreaMeta[];
  desativado?: boolean;
}) {
  if (valor == null) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink/60">Sem meta definida.</p>
        <button
          type="button"
          disabled={desativado}
          onClick={() => onChange(70)}
          className="text-sm border border-accent text-brand rounded-md px-3 py-1.5 hover:bg-accent/10 disabled:opacity-50"
        >
          Definir meta de acertos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="meta-percentual" className="text-sm">
          Quero acertar <strong className="font-mono">{valor}%</strong> da prova
        </label>
        <button
          type="button"
          disabled={desativado}
          onClick={() => onChange(null)}
          className="text-xs text-ink/60 underline hover:text-brand disabled:opacity-50"
        >
          Remover meta
        </button>
      </div>
      <input
        id="meta-percentual"
        type="range"
        min={30}
        max={100}
        step={1}
        value={Math.max(30, valor)}
        disabled={desativado}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <ul className="flex flex-wrap gap-2">
        {areas.map((a) => {
          const m = metaDaArea(a, valor);
          return (
            <li key={a.nome} className="text-xs bg-accent/10 text-brand rounded-full px-3 py-1">
              {a.nome}:{" "}
              {ehRedacao(a.nome) ? `nota ${m.notaAlvo}` : `${m.acertosAlvo}/${a.totalQuestoes} acertos`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
