import type { ReactNode } from "react";

// Versão somente leitura do bloco de importação, usada na demonstração: explica o fluxo e mostra o
// formato do arquivo em uma tabela, sem enviar nada ao servidor. As ações (baixar modelo etc.) vêm de fora.
type Props = {
  titulo: string;
  descricao: string;
  passos: string[];
  csv: string;
  children?: ReactNode;
};

function linhasDoCsv(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map((linha) => linha.split(","));
}

export default function ImportacaoDemo({ titulo, descricao, passos, csv, children }: Props) {
  const [cabecalho, ...linhas] = linhasDoCsv(csv);

  return (
    <section aria-label={titulo} className="space-y-5 rounded-xl border border-ink/10 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xs uppercase tracking-wide text-ink/60">{titulo}</h2>
          <p className="mt-1.5 text-sm text-ink/70">{descricao}</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-brand">Desativado na demonstração</span>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {passos.map((passo, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-ink/10 bg-paper/40 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-brand">{i + 1}</span>
            <span className="text-sm text-ink/80">{passo}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <p className="text-xs text-ink/60">Exemplo de arquivo CSV</p>
        <div className="overflow-x-auto rounded-lg border border-ink/10">
          <table className="w-full min-w-[32rem] text-xs">
            <thead className="bg-paper/60 text-left text-ink/60">
              <tr>
                {cabecalho.map((coluna) => (
                  <th key={coluna} scope="col" className="px-3 py-2 font-mono font-medium">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => (
                <tr key={i} className="border-t border-ink/10">
                  {cabecalho.map((coluna, j) => (
                    <td key={coluna} className="px-3 py-2 font-mono text-ink/80">
                      {linha[j] || <span className="text-ink/30">(vazio)</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <p className="text-xs text-ink/60">No seu app, a prévia mostra quantas linhas são válidas e os erros de cada uma antes de você confirmar.</p>
    </section>
  );
}
