import { createHmac, timingSafeEqual } from "node:crypto";

export const NOME_COOKIE = "sessao";
export const DURACAO_SESSAO_SEGUNDOS = 30 * 24 * 60 * 60;

// Compara em tempo constante. Hasheia antes para que strings de tamanhos
// diferentes não vazem o tamanho da senha.
function igualEmTempoConstante(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function authConfigurada(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) && Boolean(process.env.SESSION_SECRET);
}

export function verificarSenha(enviada: unknown): boolean {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada || typeof enviada !== "string" || enviada.length === 0) return false;
  return igualEmTempoConstante(enviada, esperada);
}

function assinar(payload: string, segredo: string): string {
  return createHmac("sha256", segredo).update(payload).digest("hex");
}

// Token no formato "<expiracaoEmSegundos>.<assinaturaHex>".
export function criarSessao(agora: number = Date.now()): string {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) throw new Error("SESSION_SECRET ausente");
  const exp = String(Math.floor(agora / 1000) + DURACAO_SESSAO_SEGUNDOS);
  return `${exp}.${assinar(exp, segredo)}`;
}

export function validarSessao(token: string | undefined | null, agora: number = Date.now()): boolean {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || !token) return false;
  const partes = token.split(".");
  if (partes.length !== 2) return false;
  const [exp, assinatura] = partes;
  if (!/^\d+$/.test(exp)) return false;
  if (!igualEmTempoConstante(assinatura, assinar(exp, segredo))) return false;
  return Number(exp) * 1000 > agora;
}

// Em produção o cookie leva `Secure`. Quem roda o app por HTTP puro (por exemplo, o docker compose
// numa rede local, sem HTTPS na frente) precisa de COOKIE_SEM_HTTPS=true: sem isso o navegador
// descarta o cookie e o login volta para a tela de entrada. Atrás de HTTPS, deixe a variável de fora
// (no docker compose o padrão é "true", então lá defina COOKIE_SEM_HTTPS=false).
export function cookieSeguro(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.COOKIE_SEM_HTTPS !== "true";
}

export function cookieDeSessao(token: string, producao: boolean): string {
  const partes = [
    `${NOME_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${DURACAO_SESSAO_SEGUNDOS}`,
  ];
  if (producao) partes.push("Secure");
  return partes.join("; ");
}

export function cookieDeLogout(producao: boolean): string {
  const partes = [`${NOME_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (producao) partes.push("Secure");
  return partes.join("; ");
}

// Limite de tentativas de login por IP, em memória. É um freio de melhor esforço:
// em ambiente serverless cada instância tem o seu contador.
const tentativas = new Map<string, { n: number; inicio: number }>();
const JANELA_MS = 60_000;
const MAX_TENTATIVAS = 5;

export function loginBloqueado(ip: string, agora: number = Date.now()): boolean {
  const t = tentativas.get(ip);
  if (!t || agora - t.inicio > JANELA_MS) return false;
  return t.n >= MAX_TENTATIVAS;
}

// IP usado como chave do limite de tentativas. Os cabeçalhos de IP só valem quando há um proxy
// conhecido na frente (Vercel, ou TRUST_PROXY=true para o seu próprio proxy). Fora disso o cliente
// consegue forjá-los e o limite deixaria de valer; então usamos o endereço da conexão.
export function ipDoCliente(
  cabecalhos: Record<string, string | string[] | undefined>,
  remoto: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): string {
  const confiaNoProxy = Boolean(env.VERCEL) || env.TRUST_PROXY === "true";
  const bruto = confiaNoProxy ? (cabecalhos["x-vercel-forwarded-for"] ?? cabecalhos["x-real-ip"] ?? remoto) : remoto;
  return String(bruto ?? "").split(",")[0].trim() || "desconhecido";
}

export function registrarFalhaDeLogin(ip: string, agora: number = Date.now()): void {
  if (tentativas.size > 1000) {
    for (const [k, v] of tentativas) if (agora - v.inicio > JANELA_MS) tentativas.delete(k);
    // Ainda cheio: descarta só as entradas mais antigas (o Map guarda a ordem de inserção).
    // Zerar tudo deixaria quem está sendo bloqueado tentar de novo.
    for (const k of tentativas.keys()) {
      if (tentativas.size <= 900) break;
      tentativas.delete(k);
    }
  }
  const t = tentativas.get(ip);
  if (!t || agora - t.inicio > JANELA_MS) tentativas.set(ip, { n: 1, inicio: agora });
  else t.n += 1;
}

export function limparTentativas(ip: string): void {
  tentativas.delete(ip);
}
