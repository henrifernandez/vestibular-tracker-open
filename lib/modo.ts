// Modo demonstração: só leitura, sem login, para o link público com dados fictícios.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
