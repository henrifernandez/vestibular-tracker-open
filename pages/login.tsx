import { FormEvent, useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (r.ok) {
        const destino = typeof router.query.next === "string" ? router.query.next : "/";
        // só caminhos internos, para evitar redirecionamento aberto
        const interno = destino.startsWith("/") && !destino.startsWith("//") && !destino.includes(String.fromCharCode(92));
        await router.push(interno ? destino : "/");
        return;
      }
      const dados = await r.json().catch(() => ({}));
      setErro(dados.error ?? "Não foi possível entrar.");
    } catch {
      setErro("Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-ink/10 bg-surface p-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Entrar</h1>
      <form onSubmit={entrar} className="mt-4 space-y-4">
        <div>
          <label htmlFor="senha" className="block text-sm text-ink/70">
            Senha de administrador
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/20 bg-paper px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-warn">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-full bg-accent px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
