import { useState } from "react";
import { MODELO_CSV_PLANO, PROMPT_CONVERSAO_CSV } from "@/lib/plano-modelo";

type Previa = {
  totalLinhas: number;
  validas: number;
  erros: { linha: number; mensagem: string }[];
  amostra: { data: string; materia: string; feito: boolean; topicos?: string | null }[];
};

export default function ImportarPlano({ aoImportar }: { aoImportar: () => void }) {
  const [csv, setCsv] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(confirmar: boolean) {
    setOcupado(true);
    setMensagem("");
    try {
      const r = await fetch("/api/plano/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, confirmar }),
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMensagem(dados.error ?? "Não foi possível importar.");
        if (dados.erros) setPrevia({ totalLinhas: 0, validas: 0, erros: dados.erros, amostra: [] });
        return;
      }
      if (confirmar) {
        setMensagem(`Importação concluída: ${dados.criados} novos, ${dados.atualizados} atualizados.`);
        setPrevia(null);
        setCsv("");
        aoImportar();
      } else {
        setPrevia(dados);
      }
    } catch {
      setMensagem("Não foi possível importar.");
    } finally {
      setOcupado(false);
    }
  }

  async function lerArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setPrevia(null);
    setMensagem("");
    setCsv(await arquivo.text());
  }

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([MODELO_CSV_PLANO], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-plano-de-estudo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_CONVERSAO_CSV);
      setMensagem("Prompt copiado.");
    } catch {
      setMensagem("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  const botao = "text-xs px-3 py-1.5 rounded-full border border-ink/15 text-ink/70 transition hover:border-accent/50 hover:text-brand";

  return (
    <section className="bg-surface rounded-xl border border-ink/10 p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-ink/60">Importar plano de estudo (CSV)</h2>
      <p className="text-sm text-ink/60">
        Colunas: <span className="font-mono text-xs">data, materia, feito, topicos, observacoes</span>. Importar o mesmo arquivo
        de novo atualiza as linhas, sem duplicar.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={baixarModelo} className={botao}>
          Baixar modelo
        </button>
        <button type="button" onClick={copiarPrompt} className={botao}>
          Copiar prompt para converter com IA
        </button>
        <label className={botao + " cursor-pointer"}>
          Escolher arquivo
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </label>
      </div>
      <label htmlFor="csv-plano" className="sr-only">
        Conteúdo do CSV
      </label>
      <textarea
        id="csv-plano"
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPrevia(null);
        }}
        rows={5}
        placeholder="Cole o CSV aqui ou escolha um arquivo"
        className="w-full rounded-lg border border-ink/20 bg-paper px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="button"
        disabled={!csv.trim() || ocupado}
        onClick={() => enviar(false)}
        className="text-sm px-4 py-1.5 rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
      >
        Ver prévia
      </button>

      {mensagem && (
        <p role="status" className="text-sm text-ink/70">
          {mensagem}
        </p>
      )}

      {previa && (
        <div className="space-y-2">
          <p className="text-sm">
            {previa.validas} de {previa.totalLinhas} linhas válidas
            {previa.erros.length > 0 && <span className="text-warn">, {previa.erros.length} com erro</span>}.
          </p>
          {previa.erros.length > 0 && (
            <ul className="text-xs text-warn space-y-0.5 max-h-40 overflow-auto">
              {previa.erros.slice(0, 50).map((e, i) => (
                <li key={i}>
                  Linha {e.linha}: {e.mensagem}
                </li>
              ))}
            </ul>
          )}
          {previa.amostra.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink/60">
                    <th scope="col" className="py-1 pr-3 font-medium">Data</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Matéria</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Feito</th>
                    <th scope="col" className="py-1 font-medium">Tópicos</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.amostra.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-t border-ink/10">
                      <td className="py-1 pr-3 font-mono">{l.data}</td>
                      <td className="py-1 pr-3">{l.materia}</td>
                      <td className="py-1 pr-3">{l.feito ? "sim" : "não"}</td>
                      <td className="py-1">{l.topicos ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previa.validas > 0 && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => enviar(true)}
              className="text-sm px-4 py-1.5 rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Importar {previa.validas} {previa.erros.length > 0 ? "linhas válidas" : "linhas"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
