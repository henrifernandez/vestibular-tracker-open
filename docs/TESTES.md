# Testes

Este documento explica o que cada teste do projeto cobre, como rodar e como acrescentar casos. Para o resumo de uma linha, veja a seção *Testes* do [README](../README.md).

## Como rodar

```bash
npm run typecheck     # tipos (TypeScript)
npm test              # toda a suíte (Vitest)
```

A suíte tem dois grupos:

- **Testes sem banco** (a maioria): rodam em qualquer máquina, em poucos segundos.
- **Testes com banco** (`rotas.test.ts` e `notion-sincronizacao.test.ts`): chamam as rotas da API de verdade e gravam num Postgres. Só rodam quando a variável `DATABASE_URL` aponta para um Postgres **com as migrações aplicadas**. Sem ela, são pulados (aparecem como "skipped"), e a suíte continua passando.

### Rodando também os testes com banco

Com Docker, em dois comandos:

```bash
docker run -d --rm --name tracker-pg-teste -e POSTGRES_USER=tracker -e POSTGRES_PASSWORD=tracker -e POSTGRES_DB=tracker -p 127.0.0.1:5432:5432 postgres:16
DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker npx prisma migrate deploy
```

Depois, com a mesma variável definida:

```bash
DATABASE_URL=postgresql://tracker:tracker@localhost:5432/tracker npm test
```

(No PowerShell: `$env:DATABASE_URL="postgresql://tracker:tracker@localhost:5432/tracker"; npm test`.)

> **Use um banco de teste, não o seu banco de uso.** Os testes com banco criam e apagam linhas próprias, identificadas por nomes de teste, e não tocam nas suas provas ou simulados. A exceção controlada está descrita em [Cuidado com dados reais do Notion](#cuidado-com-dados-reais-do-notion).

No CI (`.github/workflows/ci.yml`), o job `testes` sobe um Postgres, aplica as migrações e roda `npm test`, `npm run typecheck` e `npm run build`. O job `acessibilidade` roda a auditoria visual descrita abaixo.

## O que cada arquivo cobre

| Arquivo | Tipo | O que cobre |
|---|---|---|
| `auth.test.ts` | sem banco | Verificação da senha única, sessão, marca `Secure` do cookie, cookies de login e logout, IP usado no limite e limite de tentativas de login |
| `proxy.test.ts` | sem banco | O `proxy.ts` em modo normal (exige login) e em modo demonstração (só leitura), e quais caminhos ele protege |
| `provas.test.ts` | sem banco | Modelos de prova (ENEM, Fuvest, Unicamp), geração do identificador, meta por porcentagem, nota estimada (TRI), validação e contagem regressiva |
| `plano.test.ts` | sem banco | Leitura de datas, importação do CSV do plano (erros por linha, chaves estáveis), neutralização de fórmulas e cálculo do resumo semanal |
| `calendario.test.ts` | sem banco | CSV do calendário, datas do `.ics` e leitura do arquivo `.ics` |
| `limite.test.ts` | sem banco | Limite diário de avaliações por IA e o esquema de validação do simulado |
| `notion.test.ts` | sem banco | As funções do módulo `lib/notion.ts`: colunas e tipos aceitos, conversão de páginas, datas com horário no fuso de Brasília, o ID da database (puro, com hífens, ou o link inteiro) e a tradução de cada erro HTTP |
| `rotas.test.ts` | **com banco** | Rotas da API de ponta a ponta: importação do plano e do calendário (e que repetir não duplica), marcar o dia como feito, resumo semanal, simulados, provas e exportação em CSV |
| `notion-sincronizacao.test.ts` | **com banco** | A sincronização com o Notion inteira (veja a próxima seção) |

Dados de apoio ficam em `tests/fixtures/` (respostas de exemplo do Notion) e o utilitário `tests/helpers/http.ts` chama uma rota da API sem subir o servidor.

## Sincronização com o Notion (`notion-sincronizacao.test.ts`)

Este arquivo testa o que o [guia do Notion](integracoes/notion.md) promete, passando pela rota `/api/plano/notion` de verdade e gravando no Postgres de verdade. A **única** parte simulada é a API do Notion: a função `fetch` é substituída por uma que responde como o Notion (versão `2022-06-28`), só com os dois endpoints que o app usa. A suíte leva cerca de 2 segundos.

### O que está coberto (28 casos)

**Conexão**
- Testar conexão envia o token e a versão certa, consulta só o ID da database e não grava nada.
- O link inteiro da database funciona no lugar do ID (o `?v=` é ignorado).
- Sem token ou sem ID: a rota recusa e não chama o Notion.
- ID inválido: mensagem com o caminho do guia, sem chamar o Notion.
- A rota informa se está configurada (é isso que mostra ou esconde o bloco na tela).
- Ação desconhecida e métodos que não são GET/POST são rejeitados.

**Formato da database**
- `Data` como texto e falta da coluna `Feito`: o teste de conexão lista o problema e a sincronização recusa sem gravar nada.
- Nomes alternativos de coluna (Dia, Disciplina, Concluído, Assunto, Notas) são reconhecidos.

**Mensagens de erro da tabela "Problemas e soluções" do guia**
- Erros 401, 403, 404, 400 e 500 do Notion viram a mensagem esperada.
- Erro 429: o app espera e tenta de novo, e termina em "limite de requisições".
- Notion fora do ar ou lento demais: "rede ou tempo esgotado", sem vazar o token.
- Duas sincronizações em menos de 1 minuto: a segunda recebe "Aguarde um minuto entre sincronizações.".
- Uma sincronização que falha não bloqueia a próxima tentativa.

**Sincronizar**
- Grava os dias com matéria, tópicos e feito; repetir não duplica.
- O app só lê: toda chamada ao Notion é um GET da database ou um POST de consulta.
- Linha editada é atualizada; linha removida no Notion fica **inativa**, com o histórico preservado.
- **O Notion vence:** uma marcação feita no app é sobrescrita na sincronização seguinte.
- Mais de 100 linhas são lidas em páginas e todas sincronizam.
- Limite de 2.000 linhas: com exatamente 2.000, lê tudo e reconcilia; com 2.001, lê 2.000, avisa o corte (`truncado`) e não inativa nada.

**Valores da coluna Feito e avisos por linha**
- `Feito` como texto: `sim` e `x` contam como feito, `pendente` e vazio como não feito.
- `Feito` como Status: `Done` e `Concluído` contam como feito.
- Linha sem data e `Feito` inválido viram avisos, a linha válida entra e **nada é inativado** enquanto houver aviso.

### Como funciona por dentro

- **Simulador:** a função `simularNotion(estado)` devolve as respostas de acordo com um objeto de estado (`schema`, `linhas`, `status`, `pagina`). Para mudar o cenário de um teste, altere o estado antes de chamar a rota.
- **Tempo:** o app só aceita uma sincronização por minuto e guarda isso em memória. Em vez de esperar, o teste usa um relógio falso (`vi.useFakeTimers`) e a função `avancar()` anda 61 segundos entre as sincronizações. O relógio só vai para a frente, porque a rota lembra da última sincronização.
- **Identificação:** as páginas do simulador têm IDs `testevitest-N`, então a chave gravada é `notion:testevitest-N`. Os testes limpam essas linhas antes e depois de cada caso.
- **Esperas de erro 429:** usam um relógio falso de `setTimeout`, para não esperar de verdade.

### Cuidado com dados reais do Notion

Sincronizar **inativa** toda linha de origem Notion que não veio na leitura. Num banco que já tenha dados reais sincronizados, isso esconderia esses dados. Por isso o arquivo, ao começar, guarda os IDs dessas linhas e, ao terminar, as reativa. Mesmo assim, o conselho vale: rode os testes com banco num banco de teste.

### Como acrescentar um caso

1. Escolha o grupo (`describe`) mais próximo.
2. Monte o cenário com `estado` (por exemplo, `estado.linhas = aulas(3)` ou `estado.schema = "alt"`) e chame `simularNotion(estado)`.
3. Chame `testar()` ou `sincronizar()` e verifique a resposta e as linhas no banco com `doTeste()`.
4. Se o caso precisa de um tipo novo de coluna, acrescente-o em `SCHEMAS` e em `paginaDe`.

### O que estes testes **não** provam

O simulador é um modelo do Notion, escrito a partir da documentação oficial. Ele protege contra regressões no código do Tracker, mas não prova que o Notion de verdade se comporta exatamente igual, nem que os passos feitos dentro do site do Notion (criar a integração, conectar, importar o CSV) estão atualizados. Isso só se confirma seguindo o [guia](integracoes/notion.md) com uma conta real. Se algo no guia estiver diferente do que você vê na tela, abra uma issue.

## Auditoria visual e de acessibilidade

O script `scripts/auditoria-visual.ts` abre as telas principais em 375, 768 e 1280 px, salva capturas, verifica se há rolagem horizontal e roda o axe com as regras WCAG A e AA. Precisa do app rodando em modo demonstração:

```bash
npx playwright install chromium
BASE_URL=http://localhost:3100 npx tsx scripts/auditoria-visual.ts
```

Ele falha se houver violação **crítica**. Lembre que verificações automáticas pegam só parte dos problemas de acessibilidade: elas não substituem uma revisão feita por uma pessoa, com leitor de tela e teclado.

## Regras para novos testes

- Teste o comportamento (o que a rota ou a função devolve e grava), não detalhes internos.
- Todo bug corrigido ganha um teste que o reproduza.
- Testes com banco usam nomes próprios (prefixo `TesteVitest` ou `testevitest-`) e limpam o que criaram.
- Testes não devem fazer chamadas de rede de verdade: o Notion e outros serviços são simulados.
