import { useState } from "react";
import { ehRedacao } from "@/lib/redacao";
import { temAreaComTri } from "@/lib/provas";
import MetaPercentual from "@/components/MetaPercentual";

type MetaArea = { acertosAlvo: number | null; notaAlvo: number | null };
export type ProvaEditavel = {
  slug: string;
  nome: string;
  dataProva: string | null;
  metaPercentual: number | null;
  metaNota: number | null;
  areas: { id: string; nome: string; totalQuestoes: number; peso: number; metas: MetaArea[] }[];
};

const CAMPO = "mt-1 w-full border border-ink/20 rounded-md px-3 py-2 text-sm bg-transparent";

function metaAtual(a: ProvaEditavel["areas"][number]): string {
  const m = a.metas[0];
  const v = ehRedacao(a.nome) ? m?.notaAlvo : m?.acertosAlvo;
  return v != null ? String(v) : "";
}

export default function EditarProva({ prova, onSalvo }: { prova: ProvaEditavel; onSalvo: () => void }) {
  const [nome, setNome] = useState(prova.nome);
  const [dataProva, setDataProva] = useState(prova.dataProva ? prova.dataProva.slice(0, 10) : "");
  const [meta, setMeta] = useState<number | null>(prova.metaPercentual);
  const [metaNota, setMetaNota] = useState(prova.metaNota != null ? String(prova.metaNota) : "");
  const [pesos, setPesos] = useState<Record<string, string>>(Object.fromEntries(prova.areas.map((a) => [a.id, String(a.peso)])));
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const comTri = temAreaComTri(prova.areas.map((a) => a.nome));

  async function salvar() {
    setErro([]);
    const areas = prova.areas
      .map((a) => {
        const item: { id: string; peso?: number; acertosAlvo?: number | null; notaAlvo?: number | null } = { id: a.id };
        const peso = Number(pesos[a.id]);
        if (comTri && Number.isInteger(peso) && peso !== a.peso) item.peso = peso;
        if (a.id in ajustes) {
          const v = ajustes[a.id].trim() === "" ? null : Number(ajustes[a.id]);
          if (ehRedacao(a.nome)) item.notaAlvo = v;
          else item.acertosAlvo = v;
        }
        return item;
      })
      .filter((i) => Object.keys(i).length > 1);

    const corpo: Record<string, unknown> = {
      nome: nome.trim(),
      dataProva: dataProva || null,
    };
    // Só envia a meta geral quando mudou: ela refaz a meta de todas as áreas.
    if (meta !== prova.metaPercentual) corpo.metaPercentual = meta;
    if (comTri) corpo.metaNota = metaNota.trim() === "" ? null : Number(metaNota);
    if (areas.length) corpo.areas = areas;

    setEnviando(true);
    try {
      const res = await fetch(`/api/provas/${prova.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        const c = await res.json().catch(() => null);
        return setErro(c?.detalhes ?? [c?.error ?? "Não foi possível salvar."]);
      }
      onSalvo();
    } catch {
      setErro(["Não foi possível salvar. Tente novamente."]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-ink/10 pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Nome da prova
          <input className={CAMPO} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="text-sm">
          Data da prova
          <input type="date" className={CAMPO} value={dataProva} onChange={(e) => setDataProva(e.target.value)} />
        </label>
      </div>

      <MetaPercentual valor={meta} onChange={setMeta} areas={prova.areas} />

      <details className="text-sm">
        <summary className="cursor-pointer text-brand">Ajustar a meta de cada área</summary>
        <p className="text-xs text-ink/60 mt-2">
          Só as áreas que você preencher são alteradas. Se mudar a porcentagem acima, a meta de todas as áreas é recalculada.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {prova.areas.map((a) => (
            <label key={a.id} className="text-xs">
              {a.nome} {ehRedacao(a.nome) ? "(nota alvo, 0 a 1000)" : `(acertos alvo, de ${a.totalQuestoes})`}
              <input
                type="number"
                min={0}
                max={ehRedacao(a.nome) ? 1000 : a.totalQuestoes}
                className={CAMPO}
                placeholder={metaAtual(a) || "sem meta"}
                value={ajustes[a.id] ?? ""}
                onChange={(e) => setAjustes((prev) => ({ ...prev, [a.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </details>

      {comTri && (
        <details className="text-sm">
          <summary className="cursor-pointer text-brand">Nota estimada e pesos</summary>
          <p className="text-xs text-ink/60 mt-2">
            A nota estimada usa uma curva de TRI do ENEM e a média ponderada pelo peso de cada área. Veja o peso de cada área no edital do curso.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs sm:col-span-3">
              Meta da nota estimada (0 a 1000)
              <input type="number" min={0} max={1000} className={CAMPO} value={metaNota} onChange={(e) => setMetaNota(e.target.value)} placeholder="ex: 750" />
            </label>
            {prova.areas.map((a) => (
              <label key={a.id} className="text-xs">
                Peso de {a.nome}
                <input
                  type="number"
                  min={1}
                  max={10}
                  className={CAMPO}
                  value={pesos[a.id] ?? "1"}
                  onChange={(e) => setPesos((prev) => ({ ...prev, [a.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </details>
      )}

      {erro.length > 0 && (
        <ul role="alert" className="text-sm text-warn space-y-0.5">
          {erro.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={enviando}
        className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? "Salvando..." : "Salvar alterações"}
      </button>
    </div>
  );
}
