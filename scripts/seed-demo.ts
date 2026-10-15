// Recria o banco da DEMONSTRAÇÃO com dados fictícios: provas e metas, simulados,
// itens de revisão, plano de estudo e calendário (datas relativas a hoje).
//
// ATENÇÃO: apaga provas, simulados, revisão, plano e calendário do banco apontado por DATABASE_URL.
// Por isso exige DEMO_MODE=true e a flag --yes. Nunca rode contra o seu banco real.
//
// Uso: DEMO_MODE=true npx tsx scripts/seed-demo.ts --yes
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { criarSimuladosFicticios } from "../lib/demo-dados";
import { garantirProvaDeModelo } from "../lib/provas-banco";
import { modeloPorId } from "../lib/modelos-prova";
import { normalizarAssunto, sincronizarSimulados } from "../lib/revisao";
import { diaParaDate, hojeEmSaoPaulo, somarDias } from "../lib/datas";

const prisma = new PrismaClient();

// Datas oficiais de 2026 (ENEM: edital do Inep; Fuvest: calendário do vestibular 2027).
// Valem no painel e no calendário, para os dois mostrarem a mesma contagem. Ficam fixas: depois
// que passam, a contagem some, então atualize estas datas ao reaproveitar a demonstração.
const FUVEST_1A_FASE = "2026-11-01";
const ENEM_1O_DIA = "2026-11-08";
const ENEM_2O_DIA = "2026-11-15";

const MATERIAS_PLANO: { materia: string; topicos: string[] }[] = [
  { materia: "Biologia", topicos: ["Citologia; Membrana plasmática", "Genética; 1ª lei de Mendel", "Ecologia; Cadeias alimentares", "Fisiologia humana; Sistema digestório"] },
  { materia: "Química", topicos: ["Estequiometria", "Termoquímica; Entalpia", "Química orgânica; Funções oxigenadas", "Soluções; Concentração"] },
  { materia: "Física", topicos: ["Cinemática; MRU e MRUV", "Leis de Newton", "Óptica geométrica; Espelhos", "Eletrodinâmica; Lei de Ohm"] },
];

type Bloco = { hora: [string, string]; titulo: string; categoria: string };

// Semana de exemplo, de segunda (1) a sábado (6): alguns dias têm mais de um bloco, para mostrar
// que o calendário comporta uma rotina cheia. Domingo fica livre.
const SEMANA: Record<number, Bloco[]> = {
  1: [
    { hora: ["18:00", "20:00"], titulo: "Revisão de Matemática", categoria: "Matemática" },
    { hora: ["20:30", "21:30"], titulo: "Questões de Linguagens", categoria: "Linguagens" },
  ],
  2: [
    { hora: ["15:00", "17:00"], titulo: "Aula de Física e exercícios", categoria: "Física" },
    { hora: ["19:00", "20:30"], titulo: "Química: lista de exercícios", categoria: "Química" },
    { hora: ["21:00", "22:00"], titulo: "Resumo de Biologia", categoria: "Biologia" },
  ],
  3: [
    { hora: ["14:00", "15:30"], titulo: "Redação: proposta da semana", categoria: "Redação" },
    { hora: ["18:00", "20:00"], titulo: "Matemática: lista de exercícios", categoria: "Matemática" },
  ],
  4: [
    { hora: ["15:00", "16:30"], titulo: "Aula de Física e exercícios", categoria: "Física" },
    { hora: ["19:00", "20:30"], titulo: "Química: lista de exercícios", categoria: "Química" },
    { hora: ["20:45", "21:30"], titulo: "Revisão dos erros da semana", categoria: "Linguagens" },
  ],
  5: [
    { hora: ["18:00", "20:00"], titulo: "Revisão de Matemática", categoria: "Matemática" },
    { hora: ["20:30", "21:30"], titulo: "Questões de Linguagens", categoria: "Linguagens" },
  ],
  6: [
    { hora: ["09:00", "13:00"], titulo: "Simulado cronometrado", categoria: "Matemática" },
    { hora: ["15:00", "16:30"], titulo: "Correção e caderno de erros", categoria: "Linguagens" },
  ],
};

async function main() {
  if (process.env.DEMO_MODE !== "true" || !process.argv.includes("--yes")) {
    console.error("Recusado: use DEMO_MODE=true e --yes. Este script APAGA dados do banco apontado por DATABASE_URL.");
    process.exit(1);
  }
  console.log(`Banco alvo: ${new URL(process.env.DATABASE_URL || "x://").host}`);

  // 1. Limpa tudo que o seed recria. As provas também: a demonstração começa do zero.
  await prisma.revisaoLog.deleteMany();
  await prisma.conteudoRevisao.deleteMany();
  await prisma.simulado.deleteMany();
  await prisma.prova.deleteMany();
  await prisma.planoEstudo.deleteMany();
  await prisma.eventoCalendario.deleteMany();

  const hoje = hojeEmSaoPaulo();

  // 2. Duas provas de exemplo, com data futura e meta
  const enem = await garantirProvaDeModelo(prisma, modeloPorId("enem")!, {
    nome: "ENEM (exemplo)",
    dataProva: diaParaDate(ENEM_1O_DIA)!,
    metaPercentual: 75,
  });
  const fuvest = await garantirProvaDeModelo(prisma, modeloPorId("fuvest")!, {
    nome: "Fuvest 1ª fase (exemplo)",
    dataProva: diaParaDate(FUVEST_1A_FASE)!,
    metaPercentual: 70,
  });
  await prisma.prova.update({ where: { id: enem.id }, data: { metaNota: 750 } });

  // 3. Simulados fictícios (evolução crescente) e itens de revisão derivados dos conteúdos errados
  const criados = {
    enem: await criarSimuladosFicticios(prisma, enem, { quantidade: 10, fim: somarDias(hoje, -3), de: 0.36, ate: 0.68, semente: 11, prefixo: "Simulado" }),
    fuvest: await criarSimuladosFicticios(prisma, fuvest, { quantidade: 6, fim: somarDias(hoje, -6), de: 0.4, ate: 0.64, semente: 23, prefixo: "Simulado Fuvest" }),
  };
  console.log("Simulados fictícios:", criados);
  console.log("Revisão:", await sincronizarSimulados());

  // 3b. Alguns itens de revisão manuais, para a tela não ficar vazia na demonstração
  const revisao: [string, string, string, string][] = [
    ["Análise combinatória", "Matemática", "ALTA", "PENDENTE"],
    ["Genética: segunda lei de Mendel", "Biologia", "ALTA", "PENDENTE"],
    ["Termoquímica", "Química", "MEDIA", "PENDENTE"],
    ["Cinemática vetorial", "Física", "MEDIA", "REVISADO"],
    ["Figuras de linguagem", "Linguagens", "BAIXA", "PENDENTE"],
    ["Geografia econômica", "Ciências Humanas", "MEDIA", "REVISADO"],
  ];
  for (const [assunto, disciplina, prioridade, status] of revisao) {
    await prisma.conteudoRevisao.upsert({
      where: { assuntoNorm_disciplina: { assuntoNorm: normalizarAssunto(assunto), disciplina } },
      create: {
        assunto,
        assuntoNorm: normalizarAssunto(assunto),
        disciplina,
        prioridade,
        status,
        origem: "MANUAL",
        vezesErrado: 2,
        revisadoEm: status === "REVISADO" ? new Date() : null,
      },
      update: {},
    });
  }

  // 4. Plano de estudo: 4 semanas, de 14 dias atrás a 14 dias à frente
  const plano = [];
  for (let i = -14; i <= 14; i++) {
    const dia = somarDias(hoje, i);
    const dow = diaParaDate(dia)!.getUTCDay();
    if (dow === 0) continue; // domingo livre
    const m = MATERIAS_PLANO[(i + 14) % MATERIAS_PLANO.length];
    plano.push({
      chaveExterna: `demo:${m.materia}:${dia}`,
      materia: m.materia,
      data: diaParaDate(dia)!,
      topicos: m.topicos[(i + 14) % m.topicos.length],
      feito: i < 0 ? (i + 14) % 7 !== 3 : false, // quase tudo feito no passado, com uma falha por semana
      observacoes: i === 0 ? "Fazer a lista de exercícios e anotar dúvidas" : null,
      origem: "CSV",
    });
  }
  await prisma.planoEstudo.createMany({ data: plano });

  // 5. Calendário: a rotina semanal de 7 dias atrás até o fim do ENEM (no mínimo 3 semanas à frente) e as provas
  const eventos = [];
  const ultimoDia = somarDias(hoje, 21) > ENEM_2O_DIA ? somarDias(hoje, 21) : ENEM_2O_DIA;
  for (let dia = somarDias(hoje, -7); dia <= ultimoDia; dia = somarDias(dia, 1)) {
    for (const b of SEMANA[diaParaDate(dia)!.getUTCDay()] ?? []) {
      eventos.push({
        chave: `demo:${dia}:${b.hora[0]}`,
        dia: diaParaDate(dia)!,
        inicio: b.hora[0],
        fim: b.hora[1],
        titulo: b.titulo,
        categoria: b.categoria,
        tipo: "BLOCO",
        descricao: "Evento de exemplo da demonstração.",
        origem: "CSV",
      });
    }
  }
  const provas = [
    [FUVEST_1A_FASE, "Fuvest, 1ª fase"],
    [ENEM_1O_DIA, "ENEM, 1º dia"],
    [ENEM_2O_DIA, "ENEM, 2º dia"],
  ] as const;
  for (const [dia, titulo] of provas) {
    eventos.push({ chave: `demo:prova:${dia}`, dia: diaParaDate(dia)!, inicio: null, fim: null, titulo, categoria: "", tipo: "PROVA", descricao: null, origem: "CSV" });
  }
  await prisma.eventoCalendario.createMany({ data: eventos });

  console.log(`Demonstração pronta: ${plano.length} dias de plano, ${eventos.length} eventos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
