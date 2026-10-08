// Texto que o usuário vê (modelo de CSV e prompt). Sem dependências de servidor, pode ir ao navegador.
export const MODELO_CSV_PLANO =
  "data,materia,feito,topicos,observacoes\n" +
  "2026-03-02,Biologia,true,Citologia; Membrana plasmática,Revisar o resumo do capítulo\n" +
  "2026-03-03,Química,false,Estequiometria,\n" +
  "2026-03-04,Física,false,Cinemática; MRU e MRUV,Fazer a lista de exercícios\n";

export const PROMPT_CONVERSAO_CSV =
  "Converta a tabela abaixo para CSV com exatamente estas colunas, nesta ordem: " +
  "data,materia,feito,topicos,observacoes. Regras: data no formato AAAA-MM-DD; " +
  "feito apenas true ou false; não invente linhas nem dados; se um campo não existir, " +
  "deixe vazio; devolva somente o CSV, sem explicações.";
