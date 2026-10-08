import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const NAV = [
  { href: "/", label: "Painel" },
  { href: "/provas", label: "Provas e metas" },
  { href: "/resumo", label: "Resumo semanal" },
  { href: "/simulados", label: "Simulados" },
  { href: "/revisao", label: "Revisão" },
  { href: "/calendario", label: "Calendário" },
];

const NOME_APP = "Monitor de Acertos";
const DESCRICAO = "Acompanhe simulados, revisão, plano de estudo e calendário para vestibulares e ENEM.";
const TITULOS: Record<string, string> = {
  "/": "Painel",
  "/provas": "Provas e metas",
  "/resumo": "Resumo semanal",
  "/simulados": "Simulados",
  "/revisao": "Revisão",
  "/calendario": "Calendário",
  "/login": "Entrar",
  "/provas/[slug]": "Prova",
};

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const naTelaDeLogin = router.pathname === "/login";

  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    await router.push("/login");
  }

  return (
    <>
    <Head>
      <title>{TITULOS[router.pathname] ? `${TITULOS[router.pathname]} | ${NOME_APP}` : NOME_APP}</title>
      <meta name="description" content={DESCRICAO} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={NOME_APP} />
      <meta property="og:description" content={DESCRICAO} />
      <meta property="og:image" content="/og-image.png" />
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
    <div className={`min-h-screen font-sans ${display.variable} ${body.variable} ${mono.variable}`}>
      {DEMO && (
        <div role="status" className="bg-accent/15 px-4 py-2 text-center text-sm text-ink">
          Demonstração com dados fictícios. Alterações estão desativadas.
        </div>
      )}
      <header className="border-b border-ink/10 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <Link href="/" className="font-display font-semibold text-xl tracking-tight text-ink">
            Monitor de Acertos
          </Link>
          {!naTelaDeLogin && (
          <nav className="flex gap-1 text-sm flex-wrap">
            {NAV.map((item) => {
              const ativo = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "px-3 py-1.5 rounded-full transition " +
                    (ativo
                      ? "bg-accent text-white"
                      : "text-ink/60 hover:text-brand hover:bg-accent/5")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            {!DEMO && (
              <button
                type="button"
                onClick={sair}
                className="px-3 py-1.5 rounded-full text-ink/60 transition hover:text-brand hover:bg-accent/5"
              >
                Sair
              </button>
            )}
          </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Component {...pageProps} />
      </main>
    </div>
    </>
  );
}
