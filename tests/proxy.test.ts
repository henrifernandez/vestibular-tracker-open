import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { NOME_COOKIE, criarSessao } from "@/lib/auth";

const ENV = { ...process.env };

function req(caminho: string, init: { method?: string; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { host: "app.test" };
  if (init.cookie) headers.cookie = `${NOME_COOKIE}=${init.cookie}`;
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(`http://app.test${caminho}`, { method: init.method ?? "GET", headers });
}

// NextResponse.next() devolve 200 com o cabeçalho x-middleware-next.
const passou = (r: Response) => r.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "senha";
  process.env.SESSION_SECRET = "segredo-de-teste-com-32-caracteres!";
  delete process.env.DEMO_MODE;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("proxy em modo normal", () => {
  it("API sem cookie retorna 401 em JSON", async () => {
    const r = proxy(req("/api/simulados"));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "não autenticado" });
  });
  it("escrita sem cookie retorna 401", () => {
    expect(proxy(req("/api/simulados", { method: "POST" })).status).toBe(401);
    expect(proxy(req("/api/revisao/abc", { method: "DELETE" })).status).toBe(401);
    expect(proxy(req("/api/provas", { method: "POST" })).status).toBe(401);
    expect(proxy(req("/api/provas/enem-2026", { method: "PATCH" })).status).toBe(401);
    expect(proxy(req("/api/provas/enem-2026", { method: "DELETE" })).status).toBe(401);
  });
  it("página sem cookie redireciona para /login", () => {
    const r = proxy(req("/simulados"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login?next=%2Fsimulados");
  });
  it("cookie inválido é tratado como sem cookie", () => {
    expect(proxy(req("/api/simulados", { cookie: "123.abc" })).status).toBe(401);
  });
  it("cookie válido passa, inclusive para escrita", () => {
    const c = criarSessao();
    expect(passou(proxy(req("/api/simulados", { cookie: c })))).toBe(true);
    expect(passou(proxy(req("/api/simulados", { cookie: c, method: "POST" })))).toBe(true);
  });
  it("/login e /api/login são públicos", () => {
    expect(passou(proxy(req("/login")))).toBe(true);
    expect(passou(proxy(req("/api/login", { method: "POST" })))).toBe(true);
  });
  it("escrita com Origin de outro site retorna 403", () => {
    const r = proxy(req("/api/simulados", { cookie: criarSessao(), method: "POST", origin: "https://site-aleatorio.com" }));
    expect(r.status).toBe(403);
  });
  it("escrita com Origin do próprio host passa", () => {
    const r = proxy(req("/api/simulados", { cookie: criarSessao(), method: "POST", origin: "http://app.test" }));
    expect(passou(r)).toBe(true);
  });
  it("sem ADMIN_PASSWORD o app não libera nada (fail closed)", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(proxy(req("/api/simulados", { cookie: criarSessao() })).status).toBe(500);
    expect(proxy(req("/")).status).toBe(500);
  });
});

describe("proxy em modo demonstração", () => {
  beforeEach(() => {
    process.env.DEMO_MODE = "true";
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
  });
  it("GET passa sem login", () => {
    expect(passou(proxy(req("/api/simulados")))).toBe(true);
    expect(passou(proxy(req("/")))).toBe(true);
  });
  it("POST, PATCH e DELETE retornam 403", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const r = proxy(req("/api/simulados", { method }));
      expect(r.status).toBe(403);
      expect((await r.json()).error).toContain("Modo demonstração");
    }
  });
  it("criar, editar e excluir provas são bloqueados", () => {
    expect(proxy(req("/api/provas", { method: "POST" })).status).toBe(403);
    expect(proxy(req("/api/provas/enem-exemplo", { method: "PATCH" })).status).toBe(403);
    expect(proxy(req("/api/provas/enem-exemplo", { method: "DELETE" })).status).toBe(403);
    expect(passou(proxy(req("/api/provas")))).toBe(true);
  });
  it("avaliação de redação (POST) é bloqueada", () => {
    expect(proxy(req("/api/redacao/avaliar", { method: "POST" })).status).toBe(403);
  });
});

describe("matcher do proxy", () => {
  // Reproduz como o Next compila o matcher: ^ + padrão + $
  const re = new RegExp("^" + config.matcher[0] + "$");
  it("rotas de API terminadas em extensões de arquivo NÃO escapam do proxy", () => {
    for (const rota of ["/api/simulados/abc123txt", "/api/revisao/xxxsvg", "/api/simulados/x/export", "/api/x.png", "/api/provas/enem-usp"]) {
      expect(re.test(rota), rota).toBe(true);
    }
  });
  it("só os estáticos esperados ficam de fora", () => {
    for (const rota of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/favicon.svg", "/og-image.png"]) {
      expect(re.test(rota), rota).toBe(false);
    }
    expect(re.test("/login")).toBe(true);
    expect(re.test("/")).toBe(true);
  });
});
