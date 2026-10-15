import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DURACAO_SESSAO_SEGUNDOS,
  cookieDeSessao,
  cookieSeguro,
  criarSessao,
  ipDoCliente,
  limparTentativas,
  loginBloqueado,
  registrarFalhaDeLogin,
  validarSessao,
  verificarSenha,
} from "@/lib/auth";
import loginHandler from "@/pages/api/login";
import logoutHandler from "@/pages/api/logout";
import { chamar } from "./helpers/http";

const ENV = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "senha-correta";
  process.env.SESSION_SECRET = "segredo-de-teste-com-32-caracteres!";
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("verificarSenha", () => {
  it("aceita a senha correta", () => expect(verificarSenha("senha-correta")).toBe(true));
  it("recusa senha errada", () => expect(verificarSenha("outra")).toBe(false));
  it("recusa senha vazia ou ausente", () => {
    expect(verificarSenha("")).toBe(false);
    expect(verificarSenha(undefined)).toBe(false);
    expect(verificarSenha(123)).toBe(false);
  });
  it("recusa tudo se ADMIN_PASSWORD não existe (fail closed)", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(verificarSenha("senha-correta")).toBe(false);
    expect(verificarSenha("")).toBe(false);
  });
});

describe("sessão", () => {
  it("valida uma sessão recém-criada", () => expect(validarSessao(criarSessao())).toBe(true));
  it("recusa sessão expirada", () => {
    const criada = Date.now();
    const token = criarSessao(criada);
    expect(validarSessao(token, criada + (DURACAO_SESSAO_SEGUNDOS + 1) * 1000)).toBe(false);
  });
  it("recusa assinatura adulterada ou formato inválido", () => {
    const [exp] = criarSessao().split(".");
    expect(validarSessao(`${exp}.${"0".repeat(64)}`)).toBe(false);
    expect(validarSessao("lixo")).toBe(false);
    expect(validarSessao("")).toBe(false);
    expect(validarSessao(undefined)).toBe(false);
  });
  it("recusa token assinado com outro segredo", () => {
    const token = criarSessao();
    process.env.SESSION_SECRET = "outro-segredo-com-32-caracteres!!!";
    expect(validarSessao(token)).toBe(false);
  });
  it("recusa tudo se SESSION_SECRET não existe", () => {
    const token = criarSessao();
    delete process.env.SESSION_SECRET;
    expect(validarSessao(token)).toBe(false);
  });
});

describe("marca Secure do cookie", () => {
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  it("é Secure em produção por padrão", () => expect(cookieSeguro(env({ NODE_ENV: "production" }))).toBe(true));
  it("não é Secure fora de produção", () => expect(cookieSeguro(env({ NODE_ENV: "development" }))).toBe(false));
  it("COOKIE_SEM_HTTPS=true desliga em produção, e só esse valor exato", () => {
    expect(cookieSeguro(env({ NODE_ENV: "production", COOKIE_SEM_HTTPS: "true" }))).toBe(false);
    expect(cookieSeguro(env({ NODE_ENV: "production", COOKIE_SEM_HTTPS: "1" }))).toBe(true);
    expect(cookieSeguro(env({ NODE_ENV: "production", COOKIE_SEM_HTTPS: "false" }))).toBe(true);
  });
  it("o cookie mantém httpOnly e SameSite mesmo sem Secure", () => {
    const c = cookieDeSessao("x", false);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).not.toContain("Secure");
  });
});

describe("cookie nos handlers de login e logout", () => {
  const emProducao = (extra: Record<string, string> = {}) => {
    process.env = { ...process.env, NODE_ENV: "production", ...extra } as NodeJS.ProcessEnv;
  };
  const cookieDe = (r: { cabecalhos: Record<string, string | string[]> }) => String(r.cabecalhos["set-cookie"]);

  it("em produção, o login marca Secure por padrão", async () => {
    emProducao();
    delete process.env.COOKIE_SEM_HTTPS;
    const r = await chamar(loginHandler, { method: "POST", body: { senha: "senha-correta" } });
    expect(r.status).toBe(200);
    expect(cookieDe(r)).toContain("Secure");
  });
  it("com COOKIE_SEM_HTTPS=true, login e logout saem sem Secure", async () => {
    emProducao({ COOKIE_SEM_HTTPS: "true" });
    const entrada = await chamar(loginHandler, { method: "POST", body: { senha: "senha-correta" } });
    const saida = await chamar(logoutHandler, { method: "POST" });
    expect(cookieDe(entrada)).not.toContain("Secure");
    expect(cookieDe(saida)).not.toContain("Secure");
    expect(cookieDe(entrada)).toContain("HttpOnly");
  });
  it("sem NODE_ENV definido, o cookie não leva Secure", () => {
    expect(cookieSeguro({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("IP usado no limite de login", () => {
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  const cabecalhos = { "x-real-ip": "9.9.9.9", "x-vercel-forwarded-for": "8.8.8.8, 1.1.1.1" };
  it("fora de proxy conhecido ignora os cabeçalhos, que o cliente pode forjar", () => {
    expect(ipDoCliente(cabecalhos, "10.0.0.5", env({}))).toBe("10.0.0.5");
  });
  it("na Vercel usa o cabeçalho da hospedagem", () => {
    expect(ipDoCliente(cabecalhos, "10.0.0.5", env({ VERCEL: "1" }))).toBe("8.8.8.8");
  });
  it("com TRUST_PROXY=true usa o x-real-ip do seu proxy", () => {
    expect(ipDoCliente({ "x-real-ip": "9.9.9.9" }, "10.0.0.5", env({ TRUST_PROXY: "true" }))).toBe("9.9.9.9");
  });
  it("sem nenhuma informação devolve um valor fixo", () => {
    expect(ipDoCliente({}, undefined, env({}))).toBe("desconhecido");
  });
});

describe("limite de tentativas de login", () => {
  it("lotar a tabela descarta as entradas mais antigas e não libera quem já está bloqueado", () => {
    const agora = 1_000_000;
    for (let i = 0; i < 1100; i++) registrarFalhaDeLogin(`antigo-${i}`, agora);
    for (let i = 0; i < 5; i++) registrarFalhaDeLogin("alvo", agora);
    expect(loginBloqueado("alvo", agora)).toBe(true);
    for (let i = 0; i < 300; i++) registrarFalhaDeLogin(`novo-${i}`, agora);
    expect(loginBloqueado("alvo", agora)).toBe(true);
    limparTentativas("alvo");
  });
  it("bloqueia após 5 falhas e libera depois da janela", () => {
    const ip = "1.2.3.4";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) registrarFalhaDeLogin(ip, t0);
    expect(loginBloqueado(ip, t0 + 1000)).toBe(true);
    expect(loginBloqueado(ip, t0 + 61_000)).toBe(false);
  });
});
