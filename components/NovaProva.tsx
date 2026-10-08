import { useState } from "react";
import { MODELOS_PROVA, type ModeloProva } from "@/lib/modelos-prova";
import MetaPercentual from "@/components/MetaPercentual";

type AreaForm = { nome: string; totalQuestoes: string };

const CAMPO = "mt-1 w-full border border-ink/20 rounded-md px-3 py-2 text-sm bg-transparent";

// Cadastro de prova em dois passos: escolher um modelo (ou "outra prova") e conferir nome,
// data, meta e áreas. Tudo pode ser mudado antes de salvar.
export default function NovaProva({ onCriada }: { onCriada: () => void }) {
  const [modelo, setModelo] = useState<ModeloProva | null>(null);
  const [nome, setNome] = useState("");
  const [dataProva, setDataProva] = useState("");
  const [meta, setMeta] = useState<number | null>(70);
  const [areas, setAreas] = useState<AreaForm[]>([]);
  const [erro, setErro] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  function escolher(m: ModeloProva) {
    setModelo(m);
    setNome(m.id === "personalizada" ? "" : m.nome);
    setAreas(m.areas.map((a) => ({ nome: a.nome, totalQuestoes: String(a.totalQuestoes) })));
    setErro([]);
  }

  function mudarArea(i: number, campo: keyof AreaForm, valor: string) {
    setAreas((prev) => prev.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  }

  const areasValidas = areas
    .map((a) => ({ nome: a.nome.trim(), totalQuestoes: Number(a.totalQuestoes) }))
    .filter((a) => a.nome && Number.isInteger(a.totalQuestoes) && a.totalQuestoes > 0);

  async function salvar() {
    setErro([]);
    if (!nome.trim()) return setErro(["Informe o nome da prova."]);
    if (areasValidas.length !== areas.length || areas.length === 0) {
      return setErro(["Confira as áreas: cada uma precisa de nome e de um número inteiro de questões."]);
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/provas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          dataProva: dataProva || null,
          metaPercentual: meta,
          areas: areasValidas,
        }),
      });
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        return setErro(corpo?.detalhes ?? [corpo?.error ?? "Não foi possível salvar a prova."]);
      }
      setModelo(null);
      onCriada();
    } catch {
      setErro(["Não foi possível salvar a prova. Tente novamente."]);
    } finally {
      setEnviando(false);
    }
  }

  if (!modelo) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {MODELOS_PROVA.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => escolher(m)}
            className="text-left border border-ink/10 rounded-lg p-4 hover:bg-paper/60 transition"
          >
            <span className="block font-medium">{m.nome}</span>
            <span className="block text-xs text-ink/60 mt-1">{m.descricao}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Nome da prova
          <input className={CAMPO} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="ex: ENEM 2026" />
        </label>
        <label className="text-sm">
          Data da prova (opcional)
          <input type="date" className={CAMPO} value={dataProva} onChange={(e) => setDataProva(e.target.value)} />
        </label>
      </div>

      <MetaPercentual
        valor={meta}
        onChange={setMeta}
        areas={areasValidas.length ? areasValidas : areas.map((a) => ({ nome: a.nome || "Área", totalQuestoes: Number(a.totalQuestoes) || 0 }))}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Áreas da prova</legend>
        <p className="text-xs text-ink/60">Confira o edital: o número de questões muda de um ano para o outro.</p>
        {areas.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
            <label className="text-xs">
              Nome
              <input className={CAMPO} value={a.nome} maxLength={60} onChange={(e) => mudarArea(i, "nome", e.target.value)} />
            </label>
            <label className="text-xs">
              Questões
              <input
                type="number"
                min={1}
                max={300}
                className={CAMPO}
                value={a.totalQuestoes}
                onChange={(e) => mudarArea(i, "totalQuestoes", e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={areas.length === 1}
              onClick={() => setAreas((prev) => prev.filter((_, j) => j !== i))}
              className="text-xs text-ink/60 underline hover:text-brand disabled:opacity-40 pb-2"
              aria-label={`Remover a área ${a.nome || i + 1}`}
            >
              remover
            </button>
          </div>
        ))}
        {areas.length < 12 && (
          <button
            type="button"
            onClick={() => setAreas((prev) => [...prev, { nome: "", totalQuestoes: "20" }])}
            className="text-sm text-brand underline"
          >
            Adicionar área
          </button>
        )}
      </fieldset>

      {erro.length > 0 && (
        <ul role="alert" className="text-sm text-warn space-y-0.5">
          {erro.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={enviando}
          className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {enviando ? "Salvando..." : "Salvar prova"}
        </button>
        <button type="button" onClick={() => setModelo(null)} className="text-sm text-ink/60 underline">
          Voltar aos modelos
        </button>
      </div>
    </div>
  );
}
