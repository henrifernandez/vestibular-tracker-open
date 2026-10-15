// Recria o banco da DEMONSTRAÇÃO com dados fictícios: provas e metas, simulados,
// itens de revisão, plano de estudo e calendário (datas relativas a hoje).
//
// ATENÇÃO: apaga provas, simulados, revisão, plano e calendário do banco apontado por DATABASE_URL.
// Por isso exige DEMO_MODE=true e a flag --yes. Nunca rode contra o seu banco real.
//
// Uso: DEMO_MODE=true npx tsx scripts/seed-demo.ts --yes
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { criarSimuladosFicticios, hojeMais } from "../lib/demo-dados";
import { garantirProvaDeModelo } from "../lib/provas-banco";
import { modeloPorId } from "../lib/modelos-prova";
import { normalizarAssunto, sincronizarSimulados } from "../lib/revisao";
import { diaParaDate, hojeEmSaoPaulo, somarDias } from "../lib/datas";

const prisma = new PrismaClient();

// As datas das provas valem no painel e no calendário, para os dois mostrarem a mesma contagem.
const DIAS_ATE_ENEM = 32;
const DIAS_ATE_FUVEST = 55;

const MATERIAS_PLANO: { materia: string; topicos: string[] }[] = [
  { materia: "Biologia", topicos: ["Citologia; Membrana plasmática", "Genética; 1ª lei de Mendel", "Ecologia; Cadeias alimentares", "Fisiologia humana; Sistema digestório"] },
  { materia: "Química", topicos: ["Estequiometria", "Termoquímica; Entalpia", "Química orgânica; Funções oxigenadas", "Soluções; Concentração"] },
  { materia: "Física", topicos: ["Cinemática; MRU e MRUV", "Leis de Newton", "Óptica geométrica; Espelhos", "Eletrodinâmica; Lei de Ohm"] },
];

const BLOCOS: { hora: [string, string]; titulo: string; categoria: string }[] = [
  { hora: ["18:00", "20:00"], titulo: "Revisão de Matemática", categoria: "Matemática" },
  { hora: ["20:00", "21:00"], titulo: "Questões de Linguagens", categoria: "Linguagens" },
  { hora: ["15:00", "17:00"], titulo: "Aula de Física e exercícios", categoria: "Física" },
  { hora: ["14:00", "15:30"], titulo: "Redação: proposta da semana", categoria: "Redação" },
  { hora: ["19:00", "20:30"], titulo: "Química: lista de exercícios", categoria: "Química" },
];

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
    dataProva: hojeMais(hoje, DIAS_ATE_ENEM),
    metaPercentual: 75,
  });
  const fuvest = await garantirProvaDeModelo(prisma, modeloPorId("fuvest")!, {
    nome: "Fuvest 1ª fase (exemplo)",
    dataProva: hojeMais(hoje, DIAS_ATE_FUVEST),
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

  // 5. Calendário: blocos nas próximas 3 semanas e duas provas
  const eventos = [];
  for (let i = -7; i <= 21; i++) {
    const dia = somarDias(hoje, i);
    const dow = diaParaDate(dia)!.getUTCDay();
    if (dow === 0) continue;
    const b = BLOCOS[(i + 7) % BLOCOS.length];
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
  for (const [offset, titulo] of [[DIAS_ATE_ENEM, "ENEM (exemplo)"], [DIAS_ATE_FUVEST, "Fuvest 1ª fase (exemplo)"]] as const) {
    const dia = somarDias(hoje, offset);
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
