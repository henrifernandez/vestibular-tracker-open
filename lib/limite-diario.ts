import { hojeEmSaoPaulo } from "./datas";

// Limite diário de usos de um recurso caro (ex: avaliação de redação com IA).
// Contador em memória da instância: em ambiente serverless é um freio de melhor esforço,
// não uma garantia (cada instância tem o seu). Serve para evitar gasto acidental da cota.
const contadores = new Map<string, { dia: string; n: number }>();

export function limiteDiario(): number {
  const n = Number(process.env.AVALIACOES_POR_DIA);
  return Number.isInteger(n) && n > 0 ? n : 20;
}

export function consumirUso(chave: string, limite: number, agora: Date = new Date()): boolean {
  const dia = hojeEmSaoPaulo(agora);
  const atual = contadores.get(chave);
  if (!atual || atual.dia !== dia) {
    contadores.set(chave, { dia, n: 1 });
    return true;
  }
  if (atual.n >= limite) return false;
  atual.n += 1;
  return true;
}

export function reiniciarContadores(): void {
  contadores.clear();
}
