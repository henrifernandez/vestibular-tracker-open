import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

export type Resposta = { status: number; corpo: unknown; texto: string; cabecalhos: Record<string, string | string[]> };

// Chama uma rota da API sem subir o servidor.
export async function chamar(
  handler: NextApiHandler,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<Resposta> {
  const cabecalhos: Record<string, string | string[]> = {};
  let status = 200;
  let texto = "";
  const req = {
    method: init.method ?? "GET",
    body: init.body,
    query: init.query ?? {},
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as NextApiRequest;
  const res = {
    status(c: number) {
      status = c;
      return res;
    },
    setHeader(k: string, v: string | string[]) {
      cabecalhos[k.toLowerCase()] = v;
      return res;
    },
    json(v: unknown) {
      texto = JSON.stringify(v);
      return res;
    },
    send(v: string) {
      texto = v;
      return res;
    },
    end() {
      return res;
    },
    headersSent: false,
  } as unknown as NextApiResponse;
  await handler(req, res);
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null;
  }
  return { status, corpo, texto, cabecalhos };
}
