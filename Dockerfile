# Imagem do app completo (não é a demonstração). Uso: docker compose up --build
# O segredo e a senha vêm do ambiente na hora de rodar; nada sensível entra na imagem.
FROM node:22-bookworm-slim AS base
WORKDIR /app
# O Prisma precisa do OpenSSL e dos certificados no sistema.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
# O postinstall roda "prisma generate", que precisa do schema.
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
# DEMO_MODE fica de fora de propósito: o modo demonstração é decidido no build.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Aplica as migrations pendentes e sobe o servidor. A CLI do Prisma já está em node_modules.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
