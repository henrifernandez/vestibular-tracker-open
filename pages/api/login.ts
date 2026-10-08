import type { NextApiRequest, NextApiResponse } from "next";
import {
  authConfigurada,
  cookieDeSessao,
  criarSessao,
  limparTentativas,
  loginBloqueado,
  registrarFalhaDeLogin,
  verificarSenha,
} from "@/lib/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  if (!authConfigurada()) {
    console.error("ADMIN_PASSWORD ou SESSION_SECRET não definidos");
    return res.status(500).json({ error: "configuração ausente" });
  }

  // Só cabeçalhos que a hospedagem define (o x-forwarded-for pode ser forjado pelo cliente fora dela).
  const ip = String(
    req.headers["x-vercel-forwarded-for"] ?? req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "desconhecido"
  )
    .split(",")[0]
    .trim();
  if (loginBloqueado(ip)) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde um minuto." });
  }

  if (!verificarSenha(req.body?.senha)) {
    registrarFalhaDeLogin(ip);
    return res.status(401).json({ error: "Senha incorreta." });
  }

  limparTentativas(ip);
  res.setHeader("Set-Cookie", cookieDeSessao(criarSessao(), process.env.NODE_ENV === "production"));
  return res.status(200).json({ ok: true });
}
