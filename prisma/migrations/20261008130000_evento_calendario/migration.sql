-- CreateTable
CREATE TABLE "EventoCalendario" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "inicio" TEXT,
    "fim" TEXT,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'BLOCO',
    "descricao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoCalendario_chave_key" ON "EventoCalendario"("chave");

-- CreateIndex
CREATE INDEX "EventoCalendario_dia_idx" ON "EventoCalendario"("dia");

