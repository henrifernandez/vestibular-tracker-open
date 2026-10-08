import { z } from "zod";
import { diaParaDate } from "./datas";

// Aceita "AAAA-MM-DD" ou um ISO completo (usa só o dia) e devolve o dia puro em meia-noite UTC.
export const diaSchema = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    const d = diaParaDate(v.slice(0, 10));
    if (!d) {
      ctx.addIssue({ code: "custom", message: "data inválida" });
      return z.NEVER;
    }
    return d;
  });

export const resultadoSchema = z
  .object({
    areaId: z.string().min(1).max(60),
    acertos: z.number().int("acertos deve ser inteiro").min(0, "acertos não pode ser negativo").max(1000),
    totalQuestoes: z.number().int("total deve ser inteiro").min(0, "total não pode ser negativo").max(1000),
    notaEstimada: z.number().min(0).max(1000).optional().nullable(),
    textoRedacao: z.string().max(8000).optional().nullable(),
    avaliacaoIA: z.unknown().optional(),
    conteudosErrados: z.array(z.string().max(200)).max(100).optional(),
  })
  .refine((r) => r.acertos <= r.totalQuestoes, { message: "acertos não pode ser maior que o total de questões", path: ["acertos"] });

export const simuladoCriarSchema = z.object({
  provaId: z.string().min(1).max(60),
  data: diaSchema,
  nome: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  observacao: z.string().trim().max(1000).optional().nullable(),
  resultados: z.array(resultadoSchema).min(1, "informe ao menos um resultado").max(20),
});

export const revisaoCriarSchema = z.object({
  assunto: z.string().trim().min(1, "Informe o assunto.").max(200),
  prioridade: z.string().optional(),
  disciplina: z.string().trim().max(60).optional(),
  observacao: z.string().trim().max(2000).optional(),
  areaId: z.string().max(60).optional(),
});

export function mensagensDeErro(e: z.ZodError): string[] {
  return e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}
