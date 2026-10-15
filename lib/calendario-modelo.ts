import { hojeEmSaoPaulo, somarDias } from "./datas";

// Modelo de CSV mostrado ao usuário. Sem dependências de servidor, pode ir ao navegador.
export const MODELO_CSV_CALENDARIO =
  "data,inicio,fim,titulo,categoria,tipo,descricao\n" +
  "2026-03-02,18:00,20:00,Revisão de Matemática,Matemática,BLOCO,Lista de exercícios\n" +
  "2026-03-03,,,Simulado de exemplo,,PROVA,Data de prova (aparece na contagem regressiva)\n";

// O mesmo modelo com datas a partir de hoje, para o exemplo nunca ficar no passado.
export function modeloCsvCalendario(hoje: string = hojeEmSaoPaulo()): string {
  return (
    "data,inicio,fim,titulo,categoria,tipo,descricao\n" +
    `${somarDias(hoje, 1)},18:00,20:00,Revisão de Matemática,Matemática,BLOCO,Lista de exercícios\n` +
    `${somarDias(hoje, 30)},,,Simulado de exemplo,,PROVA,Data de prova (aparece na contagem regressiva)\n`
  );
}
