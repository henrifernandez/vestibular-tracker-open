// Opcional: cadastra os modelos de prova (ENEM, Fuvest, Unicamp) de uma vez, sem data nem meta.
// Não é necessário para usar o app: a página "Provas e metas" faz o mesmo pela interface.
// Roda de novo sem duplicar nada.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { MODELOS_PROVA } from "../lib/modelos-prova";
import { garantirProvaDeModelo } from "../lib/provas-banco";

const prisma = new PrismaClient();

async function main() {
  for (const modelo of MODELOS_PROVA.filter((m) => m.id !== "personalizada")) {
    await garantirProvaDeModelo(prisma, modelo);
  }
  console.log("Seed concluído: modelos de prova cadastrados. Defina data e meta em Provas e metas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
