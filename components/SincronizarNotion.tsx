import { useEffect, useState } from "react";

type Resultado = { texto: string; problemas?: string[] };

// Só aparece se NOTION_TOKEN e NOTION_DATABASE_ID estiverem configurados no servidor.
export default function SincronizarNotion({ aoSincronizar }: { aoSincronizar: () => void }) {
  const [configurado, setConfigurado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    fetch("/api/plano/notion")
      .then((r) => (r.ok ? r.json() : { configurado: false }))
      .then((d) => setConfigurado(Boolean(d.configurado)))
      .catch(() => setConfigurado(false));
  }, []);

  if (!configurado) return null;

  async function executar(acao: "testar" | "sincronizar") {
    setOcupado(true);
    setResultado(null);
    try {
      const r = await fetch("/api/plano/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setResultado({ texto: d.error ?? "Não foi possível falar com o Notion." });
      if (acao === "testar") {
        return setResultado(
          d.ok
            ? { texto: `Conexão ok com "${d.titulo}". Todas as colunas obrigatórias foram encontradas.` }
            : {
                texto: `Conectou em "${d.titulo}", mas o formato precisa de ajuste:`,
                problemas: d.problemas.map((p: { mensagem: string }) => p.mensagem),
              }
        );
      }
      const avisos: string[] = [];
      if (d.truncado) {
        avisos.push(
          `A database tem mais de ${d.sincronizados} itens. Só os primeiros ${d.sincronizados} foram lidos e nada foi marcado como inativo. Divida a database (por exemplo, uma por semestre).`
        );
      }
      for (const e of (d.erros ?? []).slice(0, 20) as { linha: number; mensagem: string }[]) avisos.push(`Item ${e.linha}: ${e.mensagem}`);
      setResultado({
        texto: `${d.sincronizados} itens sincronizados${d.inativados ? `, ${d.inativados} marcados como inativos` : ""}.`,
        problemas: avisos.length ? avisos : undefined,
      });
      aoSincronizar();
    } catch {
      setResultado({ texto: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(false);
    }
  }

  const botao =
    "text-sm px-4 py-1.5 rounded-full border border-ink/15 text-ink/70 transition hover:border-accent/50 hover:text-brand disabled:opacity-40";

  return (
    <section className="bg-surface rounded-xl border border-ink/10 p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-ink/60">Sincronizar com o Notion</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => executar("testar")} className={botao}>
          Testar conexão
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => executar("sincronizar")}
          className="text-sm px-4 py-1.5 rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {ocupado ? "Aguarde..." : "Sincronizar"}
        </button>
      </div>
      {resultado && (
        <div role="status" className="text-sm text-ink/70 space-y-1">
          <p>{resultado.texto}</p>
          {resultado.problemas && (
            <ul className="list-disc pl-5 text-xs text-warn">
              {resultado.problemas.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
