-- Plano de estudo genérico (CSV, Notion ou manual) e remoção do que era pessoal.

-- AlterTable: colunas novas
ALTER TABLE "PlanoEstudo"
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chaveExterna" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'CSV';

-- Preserva linhas existentes: a URL do Notion vira a chave externa
UPDATE "PlanoEstudo" SET "chaveExterna" = "notionUrl", "origem" = 'NOTION';

-- DropIndex
DROP INDEX "PlanoEstudo_notionUrl_key";

-- AlterTable: colunas que deixam de existir
ALTER TABLE "PlanoEstudo"
DROP COLUMN "diaSemana",
DROP COLUMN "flashcardsGerados",
DROP COLUMN "notionUrl";

-- CreateIndex
CREATE UNIQUE INDEX "PlanoEstudo_chaveExterna_key" ON "PlanoEstudo"("chaveExterna");

-- DropTable (snapshots do plugin de flashcards, removido do projeto)
DROP TABLE "RevisaoFlashcard";
