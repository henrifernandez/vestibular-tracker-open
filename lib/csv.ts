// Parser simples de CSV (sem dependências), compatível com o formato gerado
// pela exportação (campos entre aspas quando têm vírgula, aspas ou quebra de linha).

export function parseCSV(texto: string, separador: string = ","): string[][] {
  const semBOM = texto.replace(/^\uFEFF/, "");
  const linhas: string[][] = [];
  let campoAtual = "";
  let linhaAtual: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < semBOM.length; i++) {
    const char = semBOM[i];
    const proximo = semBOM[i + 1];

    if (dentroDeAspas) {
      if (char === '"' && proximo === '"') {
        campoAtual += '"';
        i++;
      } else if (char === '"') {
        dentroDeAspas = false;
      } else {
        campoAtual += char;
      }
      continue;
    }

    if (char === '"') {
      dentroDeAspas = true;
    } else if (char === separador) {
      linhaAtual.push(campoAtual);
      campoAtual = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && proximo === "\n") i++;
      linhaAtual.push(campoAtual);
      campoAtual = "";
      linhas.push(linhaAtual);
      linhaAtual = [];
    } else {
      campoAtual += char;
    }
  }

  // última linha (se o arquivo não terminar com quebra de linha)
  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  return linhas.filter((l) => l.some((campo) => campo.trim() !== ""));
}

// Excel em português exporta com ";". Decide pelo cabeçalho (primeira linha).
export function detectarSeparador(texto: string): string {
  const primeira = texto.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const pontoVirgula = (primeira.match(/;/g) ?? []).length;
  const virgula = (primeira.match(/,/g) ?? []).length;
  return pontoVirgula > virgula ? ";" : ",";
}

// Neutraliza injeção de fórmula ao abrir o CSV no Excel ou no Sheets:
// células que começam com = + - @ tab ou CR ganham um apóstrofo na frente.
export function neutralizarFormula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}
