import type { PrismaClient } from "@prisma/client";
import { metaDaArea, slugificar } from "./provas";
import type { ModeloProva } from "./modelos-prova";

// Cria (ou atualiza) uma prova a partir de um modelo. Usado pelos scripts de seed.
// Se a prova já existe (mesmo slug), mantém as áreas e só atualiza nome, data e meta.
export async function garantirProvaDeModelo(
  prisma: PrismaClient,
  modelo: ModeloProva,
  opcoes: { nome?: string; slug?: string; dataProva?: Date | null; metaPercentual?: number | null } = {}
) {
  const nome = opcoes.nome ?? modelo.nome;
  const slug = opcoes.slug ?? slugificar(nome);
  const metaPercentual = opcoes.metaPercentual ?? null;

  const prova = await prisma.prova.upsert({
    where: { slug },
    update: { nome, dataProva: opcoes.dataProva ?? null, metaPercentual },
    create: { slug, nome, descricao: modelo.descricao, dataProva: opcoes.dataProva ?? null, metaPercentual },
  });

  for (const [i, a] of modelo.areas.entries()) {
    const area = await prisma.area.upsert({
      where: { provaId_nome: { provaId: prova.id, nome: a.nome } },
      update: { totalQuestoes: a.totalQuestoes, ordem: i + 1, peso: a.peso ?? 1 },
      create: { provaId: prova.id, nome: a.nome, totalQuestoes: a.totalQuestoes, ordem: i + 1, peso: a.peso ?? 1 },
    });
    await prisma.meta.deleteMany({ where: { areaId: area.id } });
    if (metaPercentual) {
      await prisma.meta.create({ data: { areaId: area.id, label: "Minha meta", ...metaDaArea(a, metaPercentual) } });
    }
  }
  return prisma.prova.findUniqueOrThrow({ where: { id: prova.id }, include: { areas: true } });
}
