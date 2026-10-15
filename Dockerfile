# Imagem do app completo (não é a demonstração). Uso: docker compose up --build
# O segredo e a senha vêm do ambiente na hora de rodar; nada sensível entra na imagem.
FROM node:22-bookworm-slim AS base
WORKDIR /app
# O Prisma precisa do OpenSSL e dos certificados no sistema.
RUN apt-get update -y \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# O postinstall roda "prisma generate", que só precisa do schema (as migrations entram depois,
# para uma migration nova não invalidar o cache do npm ci).
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM deps AS build
COPY . .
# DEMO_MODE fica de fora de propósito: o modo demonstração é decidido no build.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Aplica as migrations pendentes e sobe o servidor. O "exec" faz o Next virar o processo principal,
# para o docker stop entregar o sinal de parada a ele. A CLI do Prisma já está em node_modules.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node_modules/.bin/next start -H 0.0.0.0 -p 3000"]
