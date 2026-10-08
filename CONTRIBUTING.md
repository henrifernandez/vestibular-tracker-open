# Como contribuir

Obrigado pelo interesse! Este é um projeto pessoal aberto, então o fluxo é simples.

## Preparando o ambiente

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npm run dev
```

## Antes de abrir um pull request

```bash
npm run typecheck
npm test          # com DATABASE_URL apontando para um Postgres migrado, roda também os testes de rotas
npm run build
```

## Padrões

- **Commits**: Conventional Commits em português (`feat(plano): ...`, `fix(calendario): ...`, `docs: ...`).
- **Pull requests pequenos**: uma mudança por PR, de preferência com testes.
- **Textos**: português do Brasil na interface e nos comentários. Evite o travessão em textos novos.
- **Segredos**: nunca commite `.env`, tokens ou dados pessoais.
- **Validação**: toda rota que recebe dados valida a entrada (zod) e responde erros genéricos, sem mensagens internas.
- **Datas**: o app usa dias puros (meia-noite UTC, formatados com `timeZone: "UTC"`) e "hoje" em `America/Sao_Paulo`. Use `lib/datas.ts`.

## O que o projeto aceita

Correções, melhorias de acessibilidade, novas fontes de importação (formatos), testes e documentação.

## O que não aceita

- Mudanças que quebrem o **modo demonstração** (somente leitura) sem justificativa.
- Integrações que dependam de serviços pagos ou de contas pessoais sem ficarem opcionais.
- Contas multiusuário e OAuth: estão fora do escopo (veja o README).
