# Monitor de Acertos

Acompanhe simulados, revisão por erros, plano de estudo e calendário na reta final para vestibulares e ENEM.

[![CI](https://github.com/henrifernandez/vestibular-tracker-open/actions/workflows/ci.yml/badge.svg)](https://github.com/henrifernandez/vestibular-tracker-open/actions/workflows/ci.yml) ![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-2F7F73) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

[English version](README.en.md)

> **O que você baixa.** O app completo, com login e todas as funções. A visualização online é este mesmo código com um interruptor (`DEMO_MODE`) que a deixa somente leitura, sem login e com dados fictícios.

## Visualização ao vivo

Há uma instância pública, **somente leitura e com dados fictícios** (nada do que você clicar altera dados), para você conhecer o app sem instalar. O endereço fica na descrição do repositório. Para usar com os seus dados, rode a sua própria cópia (veja o "Início rápido").

![Painel](docs/capturas/painel-1280.png)

| Resumo semanal | Calendário |
|---|---|
| ![Resumo semanal](docs/capturas/resumo-1280.png) | ![Calendário](docs/capturas/calendario-1280.png) |

Cadastro de prova com a meta em uma pergunta só:

![Cadastro de prova](docs/capturas/nova-prova-1280.png)

## Funcionalidades

- **Funciona para qualquer prova**: escolha um modelo pronto (ENEM, Fuvest, Unicamp) ou monte a sua com as áreas e o número de questões que quiser. Cada prova tem **data**, com contagem regressiva no painel.
- **Meta em uma pergunta só**: diga quanto quer acertar (por exemplo, 75%) e o app calcula os acertos necessários em cada área. Dá para ajustar área por área depois.
- **Simulados por prova e por área**, com a meta no gráfico de evolução, semáforo de progresso e lista dos conteúdos mais errados. Importação e exportação em CSV.
- **Nota estimada (TRI) para o ENEM**, a partir dos acertos de cada área, com pesos configuráveis (cada curso pondera de um jeito).
- **Redação avaliada por IA** (opcional, usa a API do Google Gemini com a sua chave), com nota por competência.
- **Revisão por erros**: assuntos errados duas vezes ou mais entram sozinhos na fila de revisão, com prioridade e histórico.
- **Plano de estudo e resumo semanal**: importe um CSV (ou sincronize com o Notion) e veja as aulas feitas na semana, por matéria, junto com os simulados do período.
- **Calendário**: importe um arquivo `.ics` (Google Calendar, Apple, Outlook) ou um CSV. Eventos do tipo prova viram contagem regressiva.
- **Login por senha única** e **modo demonstração** somente leitura.

## Stack

Next.js 16 (Pages Router), TypeScript, Prisma 5, PostgreSQL, Tailwind e Recharts. Roda de graça na Vercel com um banco Neon.

## Início rápido

### Com Docker (app e banco, em um comando)

Pré-requisito: Docker.

```bash
git clone https://github.com/henrifernandez/vestibular-tracker-open.git
cd vestibular-tracker-open
cp .env.example .env     # preencha ADMIN_PASSWORD e SESSION_SECRET
docker compose up --build
```

Abra http://localhost:3000 e entre com a senha de administrador. As tabelas são criadas na partida, e os dados ficam num volume do Docker: `docker compose down` mantém, `docker compose down -v` apaga.

O compose só escuta em `localhost` e se recusa a subir sem `ADMIN_PASSWORD` e `SESSION_SECRET`. Como o acesso é por HTTP, ele define `COOKIE_SEM_HTTPS=true` (sem isso o navegador descarta o cookie de sessão). Se você puser o app atrás de HTTPS, defina `COOKIE_SEM_HTTPS=false` no `.env`.

### Sem Docker (Node.js)

Pré-requisitos: Node.js 20 ou mais novo e um Postgres (local com Docker, ou gratuito no [Neon](https://neon.tech)).

```bash
git clone https://github.com/henrifernandez/vestibular-tracker-open.git
cd vestibular-tracker-open
npm install
cp .env.example .env     # preencha DATABASE_URL, ADMIN_PASSWORD e SESSION_SECRET
```

Para um Postgres local:

```bash
docker compose up -d db  # sobe só o banco em localhost:5433
# no .env: DATABASE_URL="postgresql://tracker:tracker@localhost:5433/tracker"
```

Depois:

```bash
npx prisma migrate deploy   # cria as tabelas
npm run dev                 # http://localhost:3000
```

Gere valores fortes para `ADMIN_PASSWORD` e `SESSION_SECRET` (por exemplo, `openssl rand -hex 32` para o segundo). Entre em `/login` com a senha de administrador.

Quer ver o app cheio de dados antes de usar? Use um banco **separado** e rode `DEMO_MODE=true npm run seed:demo` (veja "Modo demonstração").

## Primeiros passos

1. Abra **Provas e metas** e escolha um modelo (ENEM, Fuvest, Unicamp) ou **Outra prova** para definir as áreas você mesmo. Confira o edital: o número de questões muda de um ano para o outro.
2. Informe a **data da prova** e arraste a barra de **quanto quer acertar**. O painel passa a mostrar a contagem regressiva e a meta de cada área.
3. Registre um **simulado** em *Simulados* (ou importe um CSV). O painel compara o resultado com a meta.
4. Opcional: importe o plano de estudo e o calendário (veja abaixo).

`npx prisma db seed` cadastra os três modelos de uma vez, sem data nem meta. Não é necessário: a tela *Provas e metas* faz o mesmo.

## Variáveis de ambiente

| Nome | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | sim | Conexão com o Postgres |
| `ADMIN_PASSWORD` | sim (exceto na demo) | Senha única de login |
| `SESSION_SECRET` | sim (exceto na demo) | Segredo que assina o cookie de sessão (mínimo recomendado: 32 caracteres aleatórios) |
| `DEMO_MODE` | não | `true` liga o modo demonstração (somente leitura, sem login) |
| `COOKIE_SEM_HTTPS` | não | `true` tira a marca `Secure` do cookie de sessão. Só para acesso por HTTP fora do `localhost` (o `docker compose` já define). Atrás de HTTPS, deixe de fora |
| `GEMINI_API_KEY` | não | Habilita "Avaliar com IA" na redação. Chave gratuita em [AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODELS` | não | Lista de modelos Gemini, separados por vírgula, em ordem de preferência |
| `AVALIACOES_POR_DIA` | não | Limite diário de avaliações de redação (padrão: 20) |
| `NOTION_TOKEN` | não | Token da integração do Notion (sincronização do plano de estudo) |
| `NOTION_DATABASE_ID` | não | ID da database do Notion com o plano |

Sem `ADMIN_PASSWORD` e `SESSION_SECRET` (e fora do modo demonstração), o app **recusa todas as requisições**: ele nunca fica aberto por esquecimento.

## Plano de estudo e calendário

- **Plano de estudo (CSV)**: em *Resumo semanal*, baixe o modelo, preencha `data, materia, feito, topicos, observacoes` e importe. Há prévia com erros por linha, e importar o mesmo arquivo de novo atualiza sem duplicar. Tem um prompt pronto para converter uma tabela de outra ferramenta (como o Notion) para esse formato com uma IA.
- **Plano de estudo (Notion)**: opcional, com sincronização direta e teste de conexão. Passo a passo em [docs/integracoes/plano-de-estudo.md](docs/integracoes/plano-de-estudo.md).
- **Calendário**: importe `.ics` ou CSV. Detalhes em [docs/integracoes/calendario.md](docs/integracoes/calendario.md).

## Modo demonstração

`DEMO_MODE=true` libera leitura sem login e bloqueia qualquer escrita (HTTP 403). Os botões de escrita somem, e a avaliação de redação por IA fica indisponível. Use um **projeto e um banco separados** do seu uso real:

1. Crie um segundo banco (por exemplo, outro projeto no Neon).
2. Rode as migrations e o seed contra ele: `DATABASE_URL=... DEMO_MODE=true npm run seed:demo`.
3. Publique um segundo projeto na Vercel com `DEMO_MODE=true` e essa `DATABASE_URL`. Não coloque `ADMIN_PASSWORD` nem chaves de IA nele.

`DEMO_MODE` também precisa estar definida **na hora do build** (o banner e a ocultação dos botões são fixados no bundle). Na Vercel isso acontece sozinho, porque as variáveis do projeto valem para o build. Se você faz build local, não deixe um `DEMO_MODE=true` esquecido no `.env.local` ao gerar o build do seu uso real.

O seed da demonstração **apaga** provas, simulados, revisão, plano e calendário do banco apontado. Por isso exige `DEMO_MODE=true` e a flag `--yes`. As datas do plano e do calendário são relativas ao dia em que o seed roda (rode de novo, por exemplo uma vez por dia, para a demo não envelhecer).

## Segurança

- Todas as páginas e rotas de dados exigem sessão (cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção), exceto `/login` e no modo demonstração (somente leitura).
- Escritas verificam a origem da requisição, validam a entrada com zod e limitam tamanhos (importações de até 1 MB e 2.000 linhas).
- Erros internos nunca chegam ao cliente. Há cabeçalhos de segurança e uma CSP básica.
- A exportação em CSV neutraliza injeção de fórmula.
- **Este projeto não é multiusuário**: existe uma única senha de administrador. Para uso por várias pessoas, rode uma instância por pessoa.

Detalhes e limitações em [docs/SEGURANCA.md](docs/SEGURANCA.md). Para reportar uma vulnerabilidade, veja [SECURITY.md](SECURITY.md).

## Custos

O app roda inteiro em camadas gratuitas. A avaliação de redação usa **a sua** chave do Gemini, e a cota gratuita tem limites por dia. O app limita o uso a `AVALIACOES_POR_DIA` (20 por padrão), mas esse contador fica na memória da instância: é um freio de melhor esforço, não uma garantia. Acompanhe o uso no AI Studio.

## Integrações pessoais (não incluídas)

O autor usa o app com uma automação em n8n que lê databases do Notion e com um plugin de flashcards do RemNote. Essas integrações são específicas do ambiente pessoal e **não foram liberadas** neste repositório. Se você quiser ver ou adaptar o workflow, abra uma issue com o rótulo `integrações` ou procure o autor pelo perfil do GitHub, que o passa com o contexto necessário.

## Testes

```bash
npm run typecheck
npm test                 # testes unitários; os de rotas rodam quando DATABASE_URL aponta para um Postgres migrado
```

Para a auditoria visual e de acessibilidade (capturas em 375, 768 e 1280 px e axe), com o app rodando em modo demonstração: `npx playwright install chromium` e `npx tsx scripts/auditoria-visual.ts`.

## Como contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)
