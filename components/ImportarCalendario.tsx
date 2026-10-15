import { useEffect, useState } from "react";
import { MODELO_CSV_CALENDARIO, modeloCsvCalendario } from "@/lib/calendario-modelo";
import ImportacaoDemo from "./ImportacaoDemo";

type Previa = {
  total: number;
  validos: number;
  erros: { linha: number; mensagem: string }[];
  avisos: string[];
  amostra: { dia: string; inicio?: string | null; titulo: string; tipo: string }[];
};

// `desativado` troca o formulário pela versão somente leitura (demonstração): explica o fluxo, mostra o formato e deixa baixar o modelo.
export default function ImportarCalendario({ aoImportar, desativado = false }: { aoImportar: () => void; desativado?: boolean }) {
  const [modelo, setModelo] = useState(MODELO_CSV_CALENDARIO);
  useEffect(() => setModelo(modeloCsvCalendario()), []);
  const [conteudo, setConteudo] = useState("");
  const [formato, setFormato] = useState<"csv" | "ics">("csv");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(confirmar: boolean) {
    setOcupado(true);
    setMensagem("");
    try {
      const r = await fetch("/api/calendario/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formato, conteudo, confirmar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMensagem(d.error ?? "Não foi possível importar.");
        if (d.erros) setPrevia({ total: 0, validos: 0, erros: d.erros, avisos: [], amostra: [] });
        return;
      }
      if (confirmar) {
        setMensagem(`Importação concluída: ${d.criados} novos, ${d.atualizados} atualizados.${d.avisos?.length ? " " + d.avisos.join(" ") : ""}`);
        setPrevia(null);
        setConteudo("");
        aoImportar();
      } else setPrevia(d);
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
    setFormato(arquivo.name.toLowerCase().endsWith(".ics") ? "ics" : "csv");
    setConteudo(await arquivo.text());
  }

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([modelo], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-calendario.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const botao = "text-xs px-3 py-1.5 rounded-full border border-ink/15 text-ink/70 transition hover:border-accent/50 hover:text-brand";

  if (desativado) {
    return (
      <ImportacaoDemo
        titulo="Importar eventos (.ics ou CSV)"
        descricao="Traga o seu calendário de estudos de uma vez, em vez de digitar evento por evento. Eventos do tipo prova entram na contagem regressiva."
        passos={[
          "Exporte o calendário (no Google Calendar: Configurações, Importar e exportar, Exportar) ou use o CSV de modelo.",
          "Escolha o arquivo .ics ou .csv, ou cole o conteúdo na caixa de texto.",
          "Confira a prévia e confirme. Importar de novo atualiza os eventos, sem duplicar.",
        ]}
        csv={modelo}
      >
        <button type="button" onClick={baixarModelo} className={botao}>
          Baixar modelo CSV
        </button>
        <button type="button" disabled className={botao + " cursor-not-allowed opacity-40"}>
          Escolher arquivo
        </button>
      </ImportacaoDemo>
    );
  }

  return (
    <section className="bg-surface rounded-xl border border-ink/10 p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-ink/60">Importar eventos (.ics ou CSV)</h2>
      <p className="text-sm text-ink/60">
        Exporte seu calendário (no Google Calendar: Configurações, Importar e exportar, Exportar) e escolha o arquivo{" "}
        <span className="font-mono text-xs">.ics</span>, ou use o CSV de modelo. Importar de novo atualiza, sem duplicar.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={baixarModelo} className={botao}>
          Baixar modelo CSV
        </button>
        <label className={botao + " cursor-pointer"}>
          Escolher arquivo
          <input type="file" accept=".ics,.csv,text/calendar,text/csv" className="sr-only" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </label>
      </div>
      <div className="flex gap-3 text-xs text-ink/70">
        {(["csv", "ics"] as const).map((f) => (
          <label key={f} className="flex items-center gap-1.5">
            <input type="radio" name="formato-calendario" checked={formato === f} onChange={() => { setFormato(f); setPrevia(null); }} />
            {f === "csv" ? "CSV" : "iCalendar (.ics)"}
          </label>
        ))}
      </div>
      <label htmlFor="conteudo-calendario" className="sr-only">
        Conteúdo do arquivo
      </label>
      <textarea
        id="conteudo-calendario"
        value={conteudo}
        onChange={(e) => { setConteudo(e.target.value); setPrevia(null); }}
        rows={4}
        placeholder="Cole o conteúdo aqui ou escolha um arquivo"
        className="w-full rounded-lg border border-ink/20 bg-paper px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="button"
        disabled={!conteudo.trim() || ocupado}
        onClick={() => enviar(false)}
        className="text-sm px-4 py-1.5 rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
      >
        Ver prévia
      </button>
      {mensagem &&<p role="status" className="text-sm text-ink/70">{mensagem}</p>}
      {previa && (
        <div className="space-y-2">
          <p className="text-sm">
            {previa.validos} de {previa.total} eventos válidos
            {previa.erros.length > 0 && <span className="text-warn">, {previa.erros.length} com erro</span>}.
          </p>
          {previa.avisos.map((a, i) => <p key={i} className="text-xs text-warn">{a}</p>)}
          {previa.erros.length > 0 && (
            <ul className="text-xs text-warn space-y-0.5 max-h-40 overflow-auto">
              {previa.erros.slice(0, 50).map((e, i) => <li key={i}>Linha {e.linha}: {e.mensagem}</li>)}
            </ul>
          )}
          {previa.amostra.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink/60">
                  <th scope="col" className="py-1 pr-3 font-medium">Dia</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Hora</th>
                  <th scope="col" className="py-1 font-medium">Título</th>
                </tr>
              </thead>
              <tbody>
                {previa.amostra.slice(0, 10).map((e, i) => (
                  <tr key={i} className="border-t border-ink/10">
                    <td className="py-1 pr-3 font-mono">{e.dia}</td>
                    <td className="py-1 pr-3 font-mono">{e.inicio ?? "dia todo"}</td>
                    <td className="py-1">{e.titulo}{e.tipo === "PROVA" ? " (prova)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {previa.validos > 0 && (
            <button type="button" disabled={ocupado} onClick={() => enviar(true)} className="text-sm px-4 py-1.5 rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40">
              Importar {previa.validos} eventos
            </button>
          )}
        </div>
      )}
    </section>
  );
}
