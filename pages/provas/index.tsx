import { useEffect, useState } from "react";
import Link from "next/link";
import NovaProva from "@/components/NovaProva";
import { formatarDiaMes, hojeEmSaoPaulo, rotuloContagem } from "@/lib/datas";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type ProvaLista = {
  id: string;
  slug: string;
  nome: string;
  dataProva: string | null;
  metaPercentual: number | null;
  areas: { id: string; nome: string; totalQuestoes: number }[];
};

export default function Provas() {
  const [provas, setProvas] = useState<ProvaLista[] | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    fetch("/api/provas")
      .then((r) => r.json())
      .then((d: ProvaLista[]) => {
        setProvas(d);
        if (d.length === 0) setAdicionando(true);
      });
  }
  useEffect(carregar, []);

  async function excluir(p: ProvaLista) {
    const ok = window.confirm(
      `Excluir "${p.nome}"? Os simulados e as metas dessa prova também serão apagados. Essa ação não pode ser desfeita.`
    );
    if (!ok) return;
    setErro(null);
    const res = await fetch(`/api/provas/${p.slug}`, { method: "DELETE" });
    if (res.ok || res.status === 404) setProvas((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
    else setErro("Não foi possível excluir a prova.");
  }

  if (!provas) return <p className="text-sm text-ink/60">Carregando...</p>;
  const hoje = hojeEmSaoPaulo();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Provas e metas</h1>
        <p className="text-sm text-ink/60 mt-1">
          Escolha as provas que você vai fazer, diga a data e quanto quer acertar. Tudo pode ser mudado depois.
        </p>
      </div>

      {erro && <p role="alert" className="text-sm text-warn">{erro}</p>}

      {provas.length > 0 && (
        <ul className="space-y-2.5">
          {provas.map((p) => (
            <li key={p.id} className="bg-surface rounded-xl border border-ink/10 px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex-1 min-w-[12rem]">
                <Link href={`/provas/${p.slug}`} className="font-medium hover:text-brand">
                  {p.nome}
                </Link>
                <div className="text-xs text-ink/60 mt-0.5">
                  {p.areas.length} {p.areas.length === 1 ? "área" : "áreas"} ·{" "}
                  {p.metaPercentual != null ? `meta de ${p.metaPercentual}% de acertos` : "sem meta definida"}
                </div>
              </div>
              <div className="tabular-nums text-sm text-ink/70">
                {p.dataProva ? `${formatarDiaMes(p.dataProva)} · ${rotuloContagem(p.dataProva, hoje)}` : "sem data"}
              </div>
              <Link href={`/provas/${p.slug}`} className="text-sm text-brand underline">
                {DEMO ? "Ver" : "Editar"}
              </Link>
              {!DEMO && (
                <button type="button" onClick={() => excluir(p)} className="text-sm text-ink/60 underline hover:text-warn">
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!DEMO && (
        <section className="bg-surface rounded-xl border border-ink/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Adicionar prova</h2>
            {provas.length > 0 && (
              <button type="button" onClick={() => setAdicionando((v) => !v)} className="text-sm text-brand underline">
                {adicionando ? "Fechar" : "Nova prova"}
              </button>
            )}
          </div>
          {adicionando && (
            <NovaProva
              onCriada={() => {
                setAdicionando(false);
                carregar();
              }}
            />
          )}
        </section>
      )}
      {DEMO && <p className="text-sm text-ink/60">Na demonstração não é possível adicionar ou excluir provas.</p>}
    </div>
  );
}
