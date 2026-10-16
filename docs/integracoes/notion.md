# Sincronizar o plano de estudo com o Notion

Guia completo, do zero, para ligar uma database do Notion ao **Resumo semanal**. Leva uns 15 minutos na primeira vez. Se travar, vá direto para [Problemas e soluções](#problemas-e-soluções).

> **Antes de começar:** este caminho é opcional. Se você só quer colocar o seu plano no app, o [CSV](plano-de-estudo.md) é mais simples e não precisa de nada além de um arquivo. Use o Notion se quiser que o plano se atualize sozinho sempre que você mexer na tabela.

## O que você precisa ter

- O Vestibular Tracker **rodando na sua máquina ou na sua hospedagem**, em modo normal (com login). A [demonstração pública](https://vestibular-tracker-open.vercel.app) é somente leitura e não tem este recurso.
- Uma conta no Notion (o plano gratuito serve).
- Acesso para editar o arquivo `.env` (local ou Docker) ou as variáveis de ambiente da hospedagem (Vercel).

## Como a sincronização funciona (em 30 segundos)

```
Notion (sua tabela)  --leitura-->  Tracker (Resumo semanal)
```

- O app **só lê** o Notion. Ele nunca escreve nem altera nada na sua tabela.
- A leitura acontece **quando você clica em "Sincronizar"** no Resumo semanal (não é automática, a menos que você monte uma automação por fora).
- Cada linha da tabela vira um dia do cronograma. Sincronizar de novo atualiza as linhas em vez de duplicar.
- O Notion é a fonte da verdade: se você marcar um dia como feito no app e depois sincronizar, vale o que está no Notion.

---

## Parte 1. Preparar a database

O app precisa de uma **database** (tabela) com colunas de nomes e tipos específicos. Você pode criá-la de três jeitos. Escolha **um**.

### As colunas que o app procura

Maiúsculas e acentos não importam (`Matéria`, `materia` e `MATÉRIA` funcionam).

| Coluna | Obrigatória | Nomes aceitos | Tipos aceitos |
|---|---|---|---|
| Data | **sim** | Data, Dia, Date | **Date** (data) |
| Matéria | **sim** | Matéria, Disciplina, Subject | Select, Title, Text, Multi-select, Status |
| Feito | **sim** | Feito, Concluído, Done | **Checkbox** (recomendado), Select, Status ou Text |
| Tópicos | não | Tópicos, Conteúdo, Assunto, Topics | Text, Select, Multi-select, Title |
| Observações | não | Observações, Notas, Obs, Notes | Text, Title |

Toda database do Notion tem uma coluna de título (geralmente chamada **Nome**). Ela pode ter qualquer nome e conteúdo, a menos que você a use como a coluna Matéria.

Valores aceitos na coluna **Feito** quando ela não é checkbox: `true`, `sim`, `s`, `x`, `1`, `yes`, `feito`, `ok`, `done` e `concluído` contam como feito; `false`, `não`, `n`, `0`, `no`, `pendente` ou vazio contam como não feito. Qualquer outro valor gera um aviso na linha.

### Opção A (a mais rápida): importar o arquivo de exemplo

1. Baixe o arquivo [`docs/modelos/plano-notion-exemplo.csv`](../modelos/plano-notion-exemplo.csv).
2. No Notion, na barra lateral, clique em **Importar** (ou vá em **Configurações > Importar**) e escolha **CSV**. Selecione o arquivo. Se o seu Notion mostrar a opção em outro lugar, procure por "Importar" / "Import" no menu.
3. O Notion cria uma database com as colunas **Nome, Data, Matéria, Feito, Tópicos, Observações**, mas coloca quase tudo como texto. **Converta a coluna Data:**
   1. Clique no nome da coluna **Data**.
   2. Escolha **Editar propriedade** (*Edit property*).
   3. Em **Tipo** (*Type*), selecione **Data** (*Date*).
4. *(Opcional, mas recomendado)* Faça o mesmo com a coluna **Feito**, convertendo para **Caixa de seleção** (*Checkbox*). Se preferir deixar como texto, funciona: o app entende `true`/`false`.
5. Confira se as datas aparecem como datas (com o ícone de calendário) e não como texto cinza.

Pronto: apague as linhas de exemplo depois de testar a conexão e coloque o seu plano.

### Opção B: criar do zero

1. No Notion, crie uma página nova e escolha **Tabela** (*Table view*) / **Database**.
2. Renomeie a coluna de título para **Nome** (ou para **Matéria**, se quiser que ela seja a matéria).
3. Adicione as colunas da tabela acima: **Data** (tipo *Data*), **Matéria** (*Seleção* ou *Texto*), **Feito** (*Caixa de seleção*) e, se quiser, **Tópicos** e **Observações** (*Texto*).
4. Preencha pelo menos uma linha com data, matéria e feito.

### Opção C: usar a sua tabela atual

Se você já tem um plano no Notion, só precisa **renomear e converter as colunas** conforme a tabela acima. Cada linha **precisa ter uma data**: linhas sem data aparecem como aviso e ficam de fora.

> **Importante:** uma *visão vinculada* (*linked view*) de uma database não serve. Use a database original.

---

## Parte 2. Criar a integração no Notion

A integração é o "crachá" que dá ao app permissão para ler a sua database.

1. Abra [notion.so/profile/integrations](https://www.notion.so/profile/integrations) (logado no Notion).
2. Clique em **Nova integração** (*New integration*).
3. Dê um nome (por exemplo, `Vestibular Tracker`) e escolha o **espaço de trabalho** (*workspace*) onde está a sua database.
4. Em **Tipo**, deixe **Interna** (*Internal*).
5. Salve. Na aba **Capacidades** (*Capabilities*), confira que **Ler conteúdo** (*Read content*) está ativado. As outras podem ficar desligadas: o app só lê.
6. Na aba **Configuração** (*Configuration*), clique em **Mostrar** e **Copiar** no **Segredo da integração interna** (*Internal Integration Secret*). Ele começa com `ntn_` ou `secret_`. **Guarde-o como uma senha.**

> **Segurança:** esse segredo dá acesso de leitura à sua database. Nunca o publique, não o cole em issues, mensagens ou prints. Se ele vazar, volte à mesma tela, **gere um novo** e atualize o seu `.env`.

---

## Parte 3. Dar acesso da integração à database (o passo mais esquecido)

Criar a integração **não basta**: o Notion só deixa ela ler as páginas que você compartilhar com ela. **Sem este passo o app mostra "database não encontrada".**

1. Abra a database no Notion, em tela cheia.
2. No canto superior direito, clique nos **três pontinhos (…)**.
3. Procure **Conexões** (*Connections*) ou **Conectar a** (*Connect to*). Em algumas versões do Notion está em **Adicionar conexões** (*Add connections*).
4. Pesquise o nome da sua integração e **selecione-a**. Confirme.

Se a database está dentro de uma página, basta conectar a integração à **página de cima**: o acesso vale para tudo o que está dentro dela.

---

## Parte 4. Pegar o ID da database

O ID são **32 letras e números**. Ele está no link da database.

1. Abra a database **em tela cheia**. Se ela é uma tabela dentro de uma página, clique no título dela e escolha **Abrir como página** (*Open as page*).
2. Clique em **Compartilhar** > **Copiar link**, ou copie o endereço da barra do navegador.
3. O link tem este formato:

```
https://www.notion.so/meu-espaco/Plano-de-estudo-0123456789abcdef0123456789abcdef?v=fedcba9876543210fedcba9876543210
                                                  └──────────── este é o ID ───────┘   └── este é a VISÃO ──┘
```

- O ID da database são os **32 caracteres antes do `?v=`**.
- Os 32 caracteres **depois do `?v=`** são o ID da *visão* (a aba da tabela). **Não use esse.**

Boa notícia: o app aceita **o link inteiro** ou só o ID, com ou sem hífens. Se você colar o link completo, ele extrai o ID certo sozinho.

---

## Parte 5. Configurar o app

Você vai definir duas variáveis:

| Variável | O que colocar |
|---|---|
| `NOTION_TOKEN` | O segredo da integração (Parte 2, passo 6) |
| `NOTION_DATABASE_ID` | O ID ou o link da database (Parte 4) |

Escolha o seu caso:

### Rodando com Docker (`docker compose`)

1. No arquivo `.env` (o mesmo onde estão `ADMIN_PASSWORD` e `SESSION_SECRET`), preencha:

   ```
   NOTION_TOKEN='ntn_seu_segredo_aqui'
   NOTION_DATABASE_ID='0123456789abcdef0123456789abcdef'
   ```
2. Recrie o contêiner do app para ele ler os valores novos:

   ```bash
   docker compose up -d --force-recreate app
   ```

### Rodando local, sem Docker (`npm run dev` ou `npm start`)

1. Preencha as duas variáveis no `.env` da raiz do projeto.
2. **Pare e inicie o app de novo.** O Next.js lê o `.env` só na partida.

### Hospedado na Vercel

1. No projeto da Vercel, vá em **Settings** > **Environment Variables**.
2. Adicione `NOTION_TOKEN` e `NOTION_DATABASE_ID` (marque os ambientes que você usa, geralmente **Production**).
3. **Reimplante** o projeto (*Redeploy*) em **Deployments**. Variáveis novas só valem para implantações novas.

---

## Parte 6. Testar e sincronizar

1. Entre no app (com a sua senha) e abra **Resumo semanal**.
2. Deve aparecer o bloco **Sincronizar com o Notion**. Se não aparecer, veja [o botão não aparece](#problemas-e-soluções).
3. Clique em **Testar conexão**. Duas respostas possíveis:
   - **"Conexão ok com 'nome da sua database'. Todas as colunas obrigatórias foram encontradas."** Está tudo certo, siga para o passo 4.
   - **"Conectou em '…', mas o formato precisa de ajuste:"** seguido de uma lista. Cada item diz exatamente qual coluna falta ou está com o tipo errado. Corrija no Notion (Parte 1) e clique em Testar conexão de novo.
4. Clique em **Sincronizar**. Você verá "N itens sincronizados". Se algumas linhas tiverem problema (por exemplo, sem data), elas aparecem listadas como "Item N: motivo" e as demais entram normalmente.
5. Confira o **Cronograma completo** e o resumo dos últimos 7 dias.

---

## Regras que vale conhecer

- **Chave de cada linha:** o ID interno da página do Notion. Por isso sincronizar de novo **atualiza** em vez de duplicar, e mudar o título ou a data de uma linha atualiza a mesma entrada.
- **O que some do Notion:** se você apagar uma linha no Notion, ela some do app na sincronização seguinte (fica **inativa**: o histórico é preservado, mas ela deixa de aparecer). Isso só acontece quando a leitura inteira deu certo, para nunca esconder dados por causa de uma falha no meio.
- **Quem manda no "feito":** o Notion. Uma marcação feita no app vale até a próxima sincronização.
- **Datas com horário** viram o dia, no fuso de Brasília.
- **Limites:** até 2.000 linhas, uma sincronização por minuto, com pausas e novas tentativas automáticas se o Notion pedir calma. Se a database passar de 2.000 linhas, o app lê as primeiras 2.000, **avisa na tela** e não inativa nada naquela rodada.
- **Somente leitura:** a versão da API do Notion é fixada em `2022-06-28`.
- **Sincronização manual:** ela só acontece quando você clica em **Sincronizar**. Na versão aberta não existe agendamento. Para repetir sozinho, é preciso uma automação externa (por exemplo, n8n ou um agendador) que chame o app.

### O que ainda não é suportado

Para você não perder tempo tentando:

| Situação | O que acontece | O que fazer |
|---|---|---|
| Coluna de **fórmula, relação ou rollup** no lugar de `Data`, `Matéria` ou `Feito` | O teste de conexão acusa o tipo da coluna | Crie uma coluna simples (data, seleção ou caixa de seleção) e preencha com ela |
| **Visões e filtros** do Notion | São ignorados: o app lê a database inteira, não só o que aparece na sua visão | Tire da database o que não deve entrar, ou use uma database só para o plano |
| **Visão vinculada** (*linked view*) de outra database | O ID de uma visão vinculada não funciona | Use o ID da database original |
| **Intervalo de datas** (início e fim) | Vale só a data de início | Crie uma linha por dia |
| Database com **mais de 2.000 linhas** | Lê as primeiras 2.000 e avisa na tela | Divida a database (por exemplo, uma por semestre) |
| Database com **mais de uma fonte de dados** | Erro 400 | Veja o aviso abaixo |
| **Escrever** no Notion | Não existe: o app só lê | Marque os dias no Notion |
| Sincronizar **sozinho**, em horários fixos | Não existe na versão aberta | Automação externa (n8n, cron) |
| Várias databases ao mesmo tempo | Uma só por instalação | Junte as matérias numa database, com a coluna `Matéria` |

### Atenção: databases com mais de uma "fonte de dados"

Em 2025 o Notion lançou uma versão nova da API em que uma database pode ter várias *fontes de dados* (*data sources*). O app usa a versão estável anterior, que continua funcionando para databases comuns, com **uma** fonte. Se alguém adicionar uma segunda fonte à sua database, a leitura passa a falhar com **erro 400**. Solução: crie uma database simples só para o plano de estudo, com uma única fonte.

---

## Problemas e soluções

| O que você vê | Causa provável | Como resolver |
|---|---|---|
| O bloco "Sincronizar com o Notion" **não aparece** | As variáveis não estão definidas, o app não foi reiniciado/reimplantado, ou você está na demonstração | Confira `NOTION_TOKEN` e `NOTION_DATABASE_ID`, reinicie (Docker: `docker compose up -d --force-recreate app`; Vercel: *Redeploy*). Na demo pública o recurso não existe |
| **"database não encontrada"** | A integração não foi conectada à database (Parte 3), ou o ID está errado | Refaça a Parte 3 e confira o ID (Parte 4). Se a database está dentro de uma página, conecte a página de cima |
| **"token do Notion inválido"** | Token errado, com espaços extras, ou revogado | Copie o segredo de novo (Parte 2, passo 6). No `.env`, use aspas simples e sem espaços |
| **"o Notion negou o acesso"** (403) | A integração não tem a capacidade *Ler conteúdo* | Ative em notion.so/profile/integrations, aba **Capacidades** |
| **"NOTION_DATABASE_ID inválido"** | O valor não tem 32 caracteres de ID | Cole o link inteiro ou os 32 caracteres antes do `?v=` (Parte 4) |
| **"coluna … não encontrada"** | O nome da coluna não está na lista aceita | Renomeie (Data/Dia, Matéria/Disciplina, Feito/Concluído…) |
| **"a coluna … é do tipo …"** | Tipo da coluna errado (quase sempre *Data* como texto) | Edite a propriedade e mude o tipo (Parte 1, Opção A, passo 3) |
| **"página sem data"** (aviso numa linha) | A linha não tem valor na coluna Data | Preencha a data ou apague a linha |
| **`valor de "feito" não reconhecido`** (aviso) | A coluna Feito é texto com um valor fora da lista aceita | Use caixa de seleção, ou um dos valores aceitos |
| **"o Notion recusou a consulta (erro 400)"** | A database tem mais de uma fonte de dados | Use uma database com uma fonte só (veja o aviso acima) |
| **"Aguarde um minuto entre sincronizações."** | O limite de uma sincronização por minuto | Espere 60 segundos |
| **"limite de requisições do Notion"** | O Notion pediu calma (muitas chamadas) | Espere um minuto e tente de novo |
| **"não foi possível falar com o Notion (rede ou tempo esgotado)"** | Sem internet no servidor ou o Notion lento | Tente de novo; confira a conexão da máquina/hospedagem |
| Marquei um dia no app e ele **voltou desmarcado** | O Notion vence na sincronização | Marque o dia no Notion |
| Sincronizou, mas **faltam dias** | Linhas sem data, ou fora de uma database original | Veja a lista de avisos abaixo do botão |
| Aviso **"A database tem mais de 2000 itens"** | A database passou do limite e só as primeiras 2.000 linhas foram lidas | Divida a database (por exemplo, uma por semestre). Enquanto isso, nada é inativado |

## Como isso é testado

A sincronização é coberta por testes automatizados que passam pela rota de verdade e pelo banco, com a API do Notion simulada: 28 casos, incluindo cada mensagem de erro da tabela acima. Detalhes em [TESTES.md](../TESTES.md). Eles não substituem uma execução com uma conta Notion real, e por isso o guia pede que você avise se algum passo estiver diferente do que aparece na sua tela.

## Pedindo ajuda

Se mesmo assim não resolver, abra uma [issue](https://github.com/henrifernandez/vestibular-tracker-open/issues) ou mande uma mensagem ao autor. Para ajudar rápido, informe:

1. A **mensagem exata** que aparece ao clicar em **Testar conexão**.
2. Um print da **lista de colunas da sua database** mostrando os **tipos** (os ícones ao lado dos nomes).
3. Como você roda o app (Docker, local ou Vercel).

**Nunca envie o `NOTION_TOKEN`** nem o conteúdo do seu `.env`. Quem pedir esse valor não deve ser atendido. Se você o enviou sem querer, gere um novo segredo na página de integrações.

## Lista de conferência final

- [ ] A database tem **Data** (tipo Date), **Matéria** e **Feito**.
- [ ] Cada linha tem uma data.
- [ ] A integração é **interna** e tem **Ler conteúdo**.
- [ ] A integração foi **conectada** à database (ou à página de cima).
- [ ] `NOTION_DATABASE_ID` é o ID (ou o link) da **database**, e não da visão.
- [ ] As variáveis estão no `.env` ou na Vercel e o app foi **reiniciado/reimplantado**.
- [ ] **Testar conexão** deu "Conexão ok".
