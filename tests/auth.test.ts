import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DURACAO_SESSAO_SEGUNDOS,
  cookieDeSessao,
  cookieSeguro,
  criarSessao,
  loginBloqueado,
  registrarFalhaDeLogin,
  validarSessao,
  verificarSenha,
} from "@/lib/auth";

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

describe("limite de tentativas de login", () => {
  it("bloqueia após 5 falhas e libera depois da janela", () => {
    const ip = "1.2.3.4";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) registrarFalhaDeLogin(ip, t0);
    expect(loginBloqueado(ip, t0 + 1000)).toBe(true);
    expect(loginBloqueado(ip, t0 + 61_000)).toBe(false);
  });
});
