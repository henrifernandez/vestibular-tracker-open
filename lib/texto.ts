// Minúsculas, sem acento e sem espaços extras: usado para comparar nomes e montar chaves.
export function normalizarTexto(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
