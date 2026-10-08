import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { erroDeApi } from "@/lib/erros";
import { diaParaDate } from "@/lib/datas";
import { chaveManual, eventoSchema } from "@/lib/calendario";

// GET lista os eventos; POST cadastra um evento à mão; DELETE ?id=... remove um evento.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const eventos = await prisma.eventoCalendario.findMany({
        orderBy: [{ dia: "asc" }, { inicio: "asc" }],
        take: 5000,
      });
      return res.status(200).json(eventos);
    }

    if (req.method === "POST") {
      const r = eventoSchema.safeParse(req.body);
      if (!r.success || !diaParaDate(r.data.dia)) {
        return res.status(400).json({ error: "evento inválido", detalhes: r.success ? ["data inexistente"] : r.error.issues.map((i) => i.message) });
      }
      const e = r.data;
      const evento = await prisma.eventoCalendario.upsert({
        where: { chave: chaveManual(e) },
        create: {
          chave: chaveManual(e),
          dia: diaParaDate(e.dia)!,
          inicio: e.inicio ?? null,
          fim: e.fim ?? null,
          titulo: e.titulo,
          categoria: e.categoria ?? "",
          tipo: e.tipo,
          descricao: e.descricao ?? null,
          origem: "MANUAL",
        },
        update: {},
      });
      return res.status(201).json(evento);
    }

    if (req.method === "DELETE") {
      const q = z.object({ id: z.string().min(1).max(60) }).safeParse(req.query);
      if (!q.success) return res.status(400).json({ error: "id obrigatório" });
      await prisma.eventoCalendario.delete({ where: { id: q.data.id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    return erroDeApi(res, e);
  }
}
