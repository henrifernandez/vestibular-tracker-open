import type { NextApiRequest, NextApiResponse } from "next";
import {
  RUBRICA,
  REGRA_ANTI_HALO,
  SINAIS_SUPERFICIALIDADE,
  NIVEIS_VALIDOS,
  calibrarNota,
  type CompetenciaAvaliada,
} from "@/lib/rubrica-enem";
import { comErros } from "@/lib/erros";
import { consumirUso, limiteDiario } from "@/lib/limite-diario";

const MAX_CARACTERES_REDACAO = 8000;
const MAX_CARACTERES_TEMA = 300;
const TIMEOUT_GEMINI_MS = 30_000;

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
  },
};

const MODELOS_GEMINI = (
  process.env.GEMINI_MODELS ||
  process.env.GEMINI_MODEL ||
  "gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.8-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const TENTATIVAS_POR_MODELO = 3;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ResultadoChamada =
  | { ok: true; texto: string }
  | { ok: false; sobrecarregado: boolean; modeloIndisponivel: boolean; mensagem: string };

async function chamarGemini(
  modelo: string,
  apiKey: string,
  prompt: string
): Promise<ResultadoChamada> {
  const resposta = await fetch(
    // a chave vai no cabeçalho, não na URL, para não aparecer em logs nem em mensagens de erro
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_GEMINI_MS),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 3000 },
      }),
    }
  );

  if (resposta.ok) {
    const dados = await resposta.json();
    const texto =
      dados.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    return { ok: true, texto };
  }

  // o corpo do erro vai só para o log do servidor (nunca ao cliente, nunca com o texto da redação)
  const corpoErro = await resposta.text();
  console.error(`gemini ${modelo}: HTTP ${resposta.status} ${corpoErro.slice(0, 200)}`);
  const sobrecarregado = resposta.status === 503 || resposta.status === 429;
  const modeloIndisponivel = resposta.status === 404;
  return { ok: false, sobrecarregado, modeloIndisponivel, mensagem: `HTTP ${resposta.status}` };
}

function arredondarParaNivel(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return NIVEIS_VALIDOS.reduce((maisProximo, nivel) =>
    Math.abs(nivel - valor) < Math.abs(maisProximo - valor) ? nivel : maisProximo
  );
}

// IMPORTANTE: este prompt NUNCA mostra os números dos tetos (640, 760, 800...)
// para a IA. Se ela vir esses números como "regra", ela tende a convergir a nota
// pra eles em vez de derivar da leitura real do texto (viés de ancoragem). A IA só
// reporta o que observa (evidência por competência + sinais/flags); quem decide o
// corte numérico é a função calibrarNota, em código determinístico.
function montarPrompt(texto: string, tema?: string) {
  return `Você é um corretor certificado do ENEM aplicando a rubrica oficial do INEP. Sua função é dar um diagnóstico honesto e útil para o candidato melhorar, não agradá-lo.

${RUBRICA}

${REGRA_ANTI_HALO}

Importante: 200 não é uma nota "reservada para casos raríssimos". É o nível normal para um trecho que cumpre o descritor de 200. Se, competência a competência, a evidência bater com o descritor de 200, atribua 200 sem hesitar — inclusive nas cinco ao mesmo tempo, se for o caso. Hesitar em dar 200 por cautela é o mesmo erro que inflar por complacência: as duas distorcem a nota real.

# Procedimento obrigatório
Para CADA competência, nesta ordem, antes de decidir a nota:
1. Escolha um ou dois trechos LITERAIS da redação como prova do seu julgamento (copie exatamente como está escrito).
2. Compare esses trechos com os descritores dos 6 níveis da rubrica.
3. Só então atribua a nota, obrigatoriamente um destes valores: 0, 40, 80, 120, 160 ou 200.

Depois de pontuar as 5 competências, observe com honestidade, sem se sentir obrigado a encontrar problema onde não há:
- Quais destes sinais REALMENTE aparecem no texto, com evidência clara, exatamente com este nome: ${SINAIS_SUPERFICIALIDADE.join(", ")}. Se nenhum se aplica, devolva uma lista vazia — isso é o esperado num texto forte.
- Se o texto tem parágrafo único ou desenvolvimento muito curto (isso sim é objetivo: conte os parágrafos).

# Formato da resposta
Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois:
{"competencias": [{"nome": "<nome curto>", "nota": <0|40|80|120|160|200>, "evidencia": "<trecho literal>", "comentario": "<por que esse trecho coloca a competência nesse nível, e o que falta para o nível acima — ou 'já atinge o teto' se for 200>"}], "sinaisSuperficialidade": ["<sinal exatamente como listado acima, só se genuinamente presente>"], "flags": {"paragrafoUnicoOuDesenvolvimentoMuitoCurto": <true|false>}, "diagnostico": "<1 ou 2 frases: maior força do texto e, se houver, o maior gargalo>", "comoSubir": ["<ação concreta>", "..."], "comentarioGeral": "<2 a 4 frases honestas sobre o nível real do texto>"}

O array "competencias" deve ter exatamente 5 itens, na ordem C1, C2, C3, C4, C5.
O array "comoSubir" deve ter de 0 a 5 ações. Num texto excelente, é normal e correto que fique vazio ou com só 1 refinamento menor — não invente prioridades artificiais.
Não inclua nenhum campo de nota total, isso é calculado fora.

${tema ? `# Tema proposto\n${tema}\n\n` : ""}# Redação do candidato
"""
${texto}
"""`;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { texto, tema } = (req.body ?? {}) as { texto?: unknown; tema?: unknown };

  if (typeof texto !== "string" || texto.trim().length < 50) {
    return res
      .status(400)
      .json({ error: "Cole o texto completo da redação (mínimo de 50 caracteres)." });
  }
  if (texto.length > MAX_CARACTERES_REDACAO) {
    return res.status(413).json({ error: `A redação passa de ${MAX_CARACTERES_REDACAO} caracteres.` });
  }
  if (tema !== undefined && (typeof tema !== "string" || tema.length > MAX_CARACTERES_TEMA)) {
    return res.status(400).json({ error: `O tema deve ter até ${MAX_CARACTERES_TEMA} caracteres.` });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY não configurada no servidor. Adicione essa variável de ambiente (veja o README) para usar a avaliação por IA.",
    });
  }

  if (!consumirUso("avaliacao-redacao", limiteDiario())) {
    return res.status(429).json({ error: `Limite de ${limiteDiario()} avaliações por dia atingido. Tente amanhã.` });
  }

  const prompt = montarPrompt(texto, tema);

  let ultimaMensagemErro = "";
  let houveSobrecarga = false;

  for (const modelo of MODELOS_GEMINI) {
    for (let tentativa = 0; tentativa < TENTATIVAS_POR_MODELO; tentativa++) {
      try {
        const resultado = await chamarGemini(modelo, apiKey, prompt);

        if (resultado.ok) {
          const limpo = resultado.texto.replace(/```json|```/g, "").trim();
          try {
            const bruto = JSON.parse(limpo);

            if (!Array.isArray(bruto.competencias) || bruto.competencias.length !== 5) {
              ultimaMensagemErro = "A IA não devolveu as 5 competências.";
              continue;
            }

            const competencias: CompetenciaAvaliada[] = bruto.competencias.map((c: any) => ({
              nome: c.nome,
              nota: arredondarParaNivel(Number(c.nota)),
              evidencia: c.evidencia,
              comentario: c.comentario,
            }));

            const sinais: string[] = Array.isArray(bruto.sinaisSuperficialidade)
              ? bruto.sinaisSuperficialidade
              : [];

            const flags = {
              paragrafoUnicoOuDesenvolvimentoMuitoCurto:
                !!bruto.flags?.paragrafoUnicoOuDesenvolvimentoMuitoCurto,
            };

            const { notaBruta, notaFinal, travaAplicada } = calibrarNota(
              competencias,
              sinais,
              flags
            );

            return res.status(200).json({
              notaEstimada: notaFinal,
              notaBruta,
              travaAplicada,
              competencias,
              sinaisSuperficialidade: sinais,
              diagnostico: bruto.diagnostico,
              comoSubir: bruto.comoSubir,
              comentarioGeral: bruto.comentarioGeral,
            });
          } catch {
            ultimaMensagemErro = "A IA retornou uma resposta que não é um JSON válido.";
          }
          continue;
        }

        ultimaMensagemErro = resultado.mensagem;

        if (resultado.modeloIndisponivel) break;
        if (!resultado.sobrecarregado) break;

        houveSobrecarga = true;
        if (tentativa < TENTATIVAS_POR_MODELO - 1) {
          await esperar(1000 * Math.pow(2, tentativa));
        }
      } catch (e) {
        console.error("gemini: falha de conexão ou tempo esgotado", e instanceof Error ? e.name : "erro");
        ultimaMensagemErro = "Falha de conexão com a IA.";
      }
    }
  }

  if (houveSobrecarga) {
    return res.status(503).json({
      error:
        "Os servidores gratuitos da IA estão sobrecarregados neste momento. Já tentei algumas vezes automaticamente. Espere um minuto e clique em 'Avaliar com IA' de novo.",
    });
  }

  return res.status(502).json({
    error: "Não foi possível avaliar a redação (" + ultimaMensagemErro + "). Tente novamente em instantes.",
  });
}

export default comErros(handler);
