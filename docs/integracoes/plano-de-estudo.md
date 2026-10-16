# Plano de estudo: CSV e Notion

O plano de estudo alimenta o **Resumo semanal** (aulas feitas na semana por matéria) e o card de cronograma do painel. Há dois caminhos. Comece pelo CSV.

## Formato

| Coluna | Obrigatória | Regra |
|---|---|---|
| `data` | sim | `AAAA-MM-DD` (também aceita `DD/MM/AAAA`) |
| `materia` | sim | texto, até 60 caracteres |
| `feito` | sim | `true` ou `false` (aceita `sim`, `não`, `x`; vazio conta como não feito) |
| `topicos` | não | até 500 caracteres. Separe vários tópicos com `;` |
| `observacoes` | não | até 2000 caracteres |

O separador pode ser `,` ou `;` (o Excel em português exporta com `;`). Limites: 1 MB e 2.000 linhas por importação.

Exemplo:

```csv
data,materia,feito,topicos,observacoes
2026-03-02,Biologia,true,Citologia; Membrana plasmática,Revisar o resumo do capítulo
2026-03-03,Química,false,Estequiometria,
```

## Caminho 1: importar CSV (recomendado)

1. Abra **Resumo semanal** (precisa estar logado).
2. Clique em **Baixar modelo**, preencha, ou use **Escolher arquivo** com o seu CSV.
3. Clique em **Ver prévia**. Linhas com erro aparecem com o número da linha e o motivo, e não impedem as válidas.
4. Clique em **Importar**. Importar o mesmo arquivo de novo atualiza as linhas em vez de duplicar (a chave é matéria + dia; se houver mais de uma linha da mesma matéria no mesmo dia, o tópico entra na chave).

### Vindo de outra ferramenta (Notion, planilha)

Exporte a tabela em CSV e peça a uma IA para converter. O botão **Copiar prompt para converter com IA** copia este texto:

> Converta a tabela abaixo para CSV com exatamente estas colunas, nesta ordem: data,materia,feito,topicos,observacoes. Regras: data no formato AAAA-MM-DD; feito apenas true ou false; não invente linhas nem dados; se um campo não existir, deixe vazio; devolva somente o CSV, sem explicações.

Cole a tabela exportada depois do prompt. **Atenção:** você está enviando o conteúdo da tabela a um serviço de terceiros. Confira o resultado na prévia: a IA pode errar datas ou inventar linhas.

## Caminho 2: sincronizar direto com o Notion (opcional)

Útil se você quer que o plano se atualize a partir de uma tabela do Notion, sem exportar arquivos. Dá mais trabalho de configuração, por isso o CSV continua sendo o recomendado para começar.

**O passo a passo completo está em [notion.md](notion.md)**: como preparar a database (com um [arquivo de exemplo](../modelos/plano-notion-exemplo.csv) para importar), criar a integração, conectar, pegar o ID (o app aceita o link inteiro), configurar no Docker, local ou Vercel, testar e resolver cada mensagem de erro.

Resumo das regras, para consulta rápida:

- Somente leitura: o app nunca escreve no Notion. Versão da API fixada em `2022-06-28`.
- A chave de cada linha é o **ID da página** do Notion. Sincronizar de novo atualiza em vez de duplicar.
- A marcação feita no app (caixa de seleção do cronograma) vale até a próxima sincronização: o Notion é a fonte da verdade, então o valor do checkbox de lá volta a prevalecer. Quem usa o Notion deve marcar o dia lá.
- **Reconciliação:** itens que sumiram do Notion ficam **inativos** (somem das telas, mas o histórico permanece). Isso só acontece quando a leitura foi completa e sem erros.
- Limites: 2.000 itens, uma sincronização por minuto, pausa entre chamadas e nova tentativa em caso de limite de requisições do Notion.
- Datas com horário viram o dia no fuso de Brasília.
