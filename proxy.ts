import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NOME_COOKIE, authConfigurada, validarSessao } from "@/lib/auth";
import { isDemoMode } from "@/lib/modo";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);
const ROTAS_PUBLICAS = new Set(["/login", "/api/login"]);

function json(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ehApi = pathname.startsWith("/api/");
  const metodoSeguro = METODOS_SEGUROS.has(req.method);

  // Modo demonstração: leitura livre, nenhuma escrita.
  if (isDemoMode()) {
    if (!metodoSeguro) return json(403, "Modo demonstração: alterações desativadas");
    return NextResponse.next();
  }

  if (!authConfigurada()) {
    console.error("ADMIN_PASSWORD ou SESSION_SECRET não definidos");
    return ehApi
      ? json(500, "configuração ausente")
      : new NextResponse("Configuração ausente: defina ADMIN_PASSWORD e SESSION_SECRET.", { status: 500 });
  }

  if (ROTAS_PUBLICAS.has(pathname)) return NextResponse.next();

  if (!validarSessao(req.cookies.get(NOME_COOKIE)?.value)) {
    if (ehApi) return json(401, "não autenticado");
    const destino = new URL("/login", req.url);
    if (pathname !== "/") destino.searchParams.set("next", pathname);
    return NextResponse.redirect(destino);
  }

  // Defesa extra contra CSRF: escrita só com Origin igual ao host.
  if (!metodoSeguro) {
    const origem = req.headers.get("origin");
    if (origem) {
      let hostOrigem: string | null = null;
      try {
        hostOrigem = new URL(origem).host;
      } catch {
        // "null" ou valor inválido
      }
      if (hostOrigem !== req.headers.get("host")) return json(403, "origem não permitida");
    }
  }

  return NextResponse.next();
}

// Só passam sem o proxy os arquivos estáticos do Next e três arquivos públicos exatos.
// Nada de padrão por extensão: um id de API terminado em "txt" ou "png" não pode escapar.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon[.]ico|favicon[.]svg|og-image[.]png).*)"],
};
