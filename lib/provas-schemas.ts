import { z } from "zod";
import { diaSchema } from "./schemas";
import { normalizarTexto } from "./texto";
import { MAX_AREAS } from "./provas";

const nomeAreaSchema = z.string().trim().min(1, "Informe o nome da área.").max(60);

const areaEntradaSchema = z.object({
  nome: nomeAreaSchema,
  totalQuestoes: z.number().int("Informe um número inteiro de questões.").min(1, "Use ao menos 1 questão.").max(300),
  peso: z.number().int().min(1).max(10).optional(),
});

function nomesUnicos(areas: { nome: string }[]): boolean {
  const vistos = new Set(areas.map((a) => normalizarTexto(a.nome)));
  return vistos.size === areas.length;
}

export const provaCriarSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da prova.").max(80),
  descricao: z.string().trim().max(300).nullish(),
  dataProva: diaSchema.nullish(),
  metaPercentual: z.number().int().min(1, "A meta deve ficar entre 1% e 100%.").max(100, "A meta deve ficar entre 1% e 100%.").nullish(),
  areas: z
    .array(areaEntradaSchema)
    .min(1, "Inclua ao menos uma área.")
    .max(MAX_AREAS, `No máximo ${MAX_AREAS} áreas por prova.`)
    .refine(nomesUnicos, { message: "Os nomes das áreas não podem se repetir." }),
});

// Edição: todos os campos são opcionais. null apaga (data, meta); ausente mantém.
export const provaAtualizarSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  descricao: z.string().trim().max(300).nullish(),
  dataProva: diaSchema.nullish(),
  metaPercentual: z.number().int().min(1).max(100).nullish(),
  metaNota: z.number().min(0).max(1000).nullish(),
  areas: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        peso: z.number().int().min(1).max(10).optional(),
        acertosAlvo: z.number().int().min(0).max(300).nullish(),
        notaAlvo: z.number().min(0).max(1000).nullish(),
      })
    )
    .max(MAX_AREAS)
    .optional(),
});
