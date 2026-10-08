# Segurança

Resumo do modelo de segurança, do que foi revisado e das limitações conhecidas.

## Modelo

- **Uma senha de administrador** (`ADMIN_PASSWORD`). Não há contas de usuário.
- Sessão em cookie `sessao`: `httpOnly`, `SameSite=Lax`, `Secure` em produção, validade de 30 dias. O valor é `<expiração>.<HMAC-SHA256>`, assinado com `SESSION_SECRET`.
- A senha é comparada em tempo constante. Há limite de 5 tentativas de login por minuto por IP.
- `proxy.ts` (o antigo middleware do Next) protege **todas** as páginas e rotas de API. Só `/login` e `/api/login` são públicas.
- **Fail closed:** sem `ADMIN_PASSWORD` ou `SESSION_SECRET` (fora do modo demonstração) o app responde 500 a tudo, em vez de ficar aberto.
- Escritas (POST, PATCH, DELETE) exigem que o cabeçalho `Origin`, quando presente, seja o próprio host.

## Modo demonstração

`DEMO_MODE=true`: leitura livre, qualquer método de escrita responde 403. Use **sempre** um banco separado e sem dados reais. Não defina `ADMIN_PASSWORD`, `NOTION_TOKEN` nem `GEMINI_API_KEY` na demo.

## Revisão feita

| Tema | Situação |
|---|---|
| Rotas de escrita sem autenticação | Corrigido: proxy exige sessão |
| Leitura pública de dados pessoais | Corrigido: proxy exige sessão (exceto na demo, com dados fictícios) |
| Validação de entrada | zod em provas, simulados, plano, calendário, resumo; limites de tamanho nos textos |
| `acertos <= total`, inteiros, datas válidas | Validado (formulário, API e importação de CSV) |
| Erros internos vazando (Prisma, Gemini) | Corrigido: `comErros` devolve mensagem genérica e registra no log do servidor |
| Injeção de fórmula na exportação CSV | Corrigido: células iniciadas por `= + - @` ganham apóstrofo |
| Importações sem limite | Corrigido: 1 MB e 2.000 linhas (413 acima do limite) |
| Redação por IA sem limites | 8.000 caracteres, timeout de 30 s, 20 avaliações por dia, chave no cabeçalho e não na URL, texto da redação nunca vai para o log |
| Datas deslocadas por fuso | Dias puros em UTC, "hoje" em `America/Sao_Paulo` |
| Cabeçalhos | `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` e CSP básica |
| Token do Notion | Só no servidor; nunca aparece em respostas ou logs (há teste) |

## Limitações conhecidas

- **Não é multiusuário.** Uma instância por pessoa.
- **O limite de login e o de avaliações de redação ficam na memória da instância.** Em ambiente serverless cada instância tem o seu contador, então são freios de melhor esforço, não garantias.
- **CSP com `unsafe-inline`:** o Pages Router injeta scripts e estilos inline. Migrar para nonces exigiria o App Router.
- **Sessões não são revogáveis individualmente.** Para invalidar todas, troque o `SESSION_SECRET`.
- O texto da redação é enviado ao Google Gemini quando você usa "Avaliar com IA". Não use com conteúdo que você não queira enviar a um terceiro.
- O cookie de sessão é `Secure` em produção: em produção o login só funciona por HTTPS (ou em `localhost`). Quem hospeda em rede local sem HTTPS precisa de um proxy com TLS.
- **Dependências:** `npm audit --omit=dev` está limpo (Next atualizado para 16.4.0, que corrige avisos críticos da 16.3.x). O `npm audit` completo ainda lista avisos em dependências de **desenvolvimento** (ferramentas de build e teste, por exemplo `braces`), que não vão para o servidor em produção. Dependabot acompanha as atualizações.
- **Modo demonstração sobre um banco real expõe tudo para leitura.** O app não consegue saber se o banco é de demonstração: use sempre um banco separado e descartável.
- `DEMO_MODE` é lida em tempo de execução pelo proxy e fixada no build para o navegador (`NEXT_PUBLIC_DEMO_MODE`). Mantenha as duas iguais no mesmo projeto.
- `GET /api/simulados` devolve todos os simulados, sem paginação (inclui textos de redação). Para uso pessoal o volume é pequeno.
- A avaliação de redação no pior caso (3 modelos, 3 tentativas, 30 s cada) pode passar do tempo máximo de uma função serverless. A cota diária é consumida antes da chamada e não é devolvida em caso de falha.
- O resumo semanal conta linhas do plano, não dias distintos: duas linhas da mesma matéria no mesmo dia contam como dois dias planejados.
- Eventos do `.ics` que mudam de dia no calendário de origem geram outra chave: o antigo permanece até ser removido na tela.
- A importação do Notion grava até 2.000 itens numa única transação.

## Revisão independente

Uma revisão por um segundo agente (somente leitura) encontrou um problema alto, já corrigido: o padrão do `matcher` do proxy tinha um escape perdido e deixava passar rotas de API cujo último trecho terminava em `png`, `txt` etc. Agora o matcher não exclui nada de `/api/` e há teste de regressão. Também foram corrigidos: chave do Notion pelo id da página (e não pela URL), chave estável das linhas do CSV do plano, limite de eventos do `.ics` depois da expansão, datas inválidas no `.ics`, idempotência e validação da importação de simulados por CSV, duplicidade do ENEM no resumo semanal, IP do limite de login, redirecionamento após o login e `Origin` inválido.
