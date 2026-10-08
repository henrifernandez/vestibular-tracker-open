import { describe, expect, it } from "vitest";
import { analisarCsvCalendario, analisarIcs, lerDataIcs } from "@/lib/calendario";
import { MODELO_CSV_CALENDARIO } from "@/lib/calendario-modelo";

const ics = (corpo: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${corpo}END:VCALENDAR\r\n`;

describe("CSV do calendário", () => {
  it("aceita o modelo", () => {
    const r = analisarCsvCalendario(MODELO_CSV_CALENDARIO);
    expect(r.erros).toEqual([]);
    expect(r.eventos).toHaveLength(2);
    expect(r.eventos[1]).toMatchObject({ tipo: "PROVA", dia: "2026-03-03" });
  });
  it("reporta hora inválida e dia inválido por linha", () => {
    const r = analisarCsvCalendario("data,inicio,titulo\n2026-03-01,25:00,A\n2026-02-30,10:00,B\n2026-03-02,10:00,C\n");
    expect(r.eventos).toHaveLength(1);
    expect(r.erros.map((e) => e.linha)).toEqual([2, 3]);
  });
  it("é idempotente (mesmas chaves) e rejeita duplicata no arquivo", () => {
    const csv = "data,inicio,titulo\n2026-03-01,10:00,A\n2026-03-01,10:00,A\n";
    const r = analisarCsvCalendario(csv);
    expect(r.eventos).toHaveLength(1);
    expect(r.erros).toHaveLength(1);
    expect(analisarCsvCalendario(csv).eventos[0].chave).toBe(r.eventos[0].chave);
  });
  it("exige data e título", () => {
    expect(analisarCsvCalendario("data\n2026-03-01\n").erros[0].mensagem).toContain("titulo");
  });
});

describe("datas do .ics", () => {
  it("UTC vira horário de Brasília (e pode mudar o dia)", () => {
    expect(lerDataIcs("DTSTART", "20261001T033000Z")).toEqual({ dia: "2026-10-01", hora: "00:30" });
    expect(lerDataIcs("DTSTART", "20261001T023000Z")).toEqual({ dia: "2026-09-30", hora: "23:30" });
  });
  it("TZID de Brasília e horário flutuante ficam como estão", () => {
    expect(lerDataIcs("DTSTART;TZID=America/Sao_Paulo", "20261001T003000")).toEqual({ dia: "2026-10-01", hora: "00:30" });
    expect(lerDataIcs("DTSTART", "20261001T003000")).toEqual({ dia: "2026-10-01", hora: "00:30" });
  });
  it("converte de outro fuso", () => {
    // 10:00 em Nova York (EDT, UTC-4) = 11:00 em Brasília (UTC-3)
    expect(lerDataIcs("DTSTART;TZID=America/New_York", "20261001T100000")).toEqual({ dia: "2026-10-01", hora: "11:00" });
  });
  it("dia inteiro não tem hora", () => {
    expect(lerDataIcs("DTSTART;VALUE=DATE", "20261001")).toEqual({ dia: "2026-10-01", hora: null });
  });
  it("rejeita lixo", () => expect(lerDataIcs("DTSTART", "ontem")).toBeNull());
});

describe("arquivo .ics", () => {
  it("lê evento simples, desfaz escapes e linhas dobradas", () => {
    const r = analisarIcs(
      ics(
        "BEGIN:VEVENT\r\nUID:abc@x\r\nDTSTART;TZID=America/Sao_Paulo:20261001T180000\r\nDTEND;TZID=America/Sao_Paulo:20261001T200000\r\n" +
          "SUMMARY:Física\\, aula 1\\; revisão\r\nDESCRIPTION:Linha um\\nLinha\r\n  dois\r\nEND:VEVENT\r\n"
      )
    );
    expect(r.erros).toEqual([]);
    expect(r.eventos).toHaveLength(1);
    expect(r.eventos[0]).toMatchObject({
      dia: "2026-10-01",
      inicio: "18:00",
      fim: "20:00",
      titulo: "Física, aula 1; revisão",
      chave: "ics:abc@x:2026-10-01",
      origem: "ICS",
    });
    expect(r.eventos[0].descricao).toBe("Linha um\nLinha dois");
  });
  it("evento de dia inteiro com várias datas vira um por dia (DTEND exclusivo)", () => {
    const r = analisarIcs(ics("BEGIN:VEVENT\r\nUID:p\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261104\r\nSUMMARY:Semana de provas\r\nEND:VEVENT\r\n"));
    expect(r.eventos.map((e) => e.dia)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });
  it("avisa sobre eventos recorrentes", () => {
    const r = analisarIcs(ics("BEGIN:VEVENT\r\nUID:r\r\nDTSTART:20261001T100000Z\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Aula\r\nEND:VEVENT\r\n"));
    expect(r.eventos).toHaveLength(1);
    expect(r.avisos[0]).toContain("recorrente");
  });
  it("importar de novo gera as mesmas chaves (UID estável)", () => {
    const arq = ics("BEGIN:VEVENT\r\nUID:z\r\nDTSTART:20261001T100000Z\r\nSUMMARY:A\r\nEND:VEVENT\r\n");
    expect(analisarIcs(arq).eventos[0].chave).toBe(analisarIcs(arq).eventos[0].chave);
  });
  it("recusa arquivo que não é .ics", () => {
    expect(analisarIcs("isso não é um calendário").erros[0].mensagem).toContain("BEGIN:VCALENDAR");
  });
  it("evento sem data vira erro", () => {
    const r = analisarIcs(ics("BEGIN:VEVENT\r\nUID:q\r\nSUMMARY:Sem data\r\nEND:VEVENT\r\n"));
    expect(r.eventos).toEqual([]);
    expect(r.erros).toHaveLength(1);
  });
  it("título com [prova] vira data de prova", () => {
    const evento = ["BEGIN:VEVENT", "UID:pv", "DTSTART;VALUE=DATE:20261108", "SUMMARY:[Prova] Enem dia 1", "END:VEVENT"].join("\r\n");
    const r = analisarIcs(ics(evento + "\r\n"));
    expect(r.eventos[0]).toMatchObject({ tipo: "PROVA", titulo: "Enem dia 1", dia: "2026-11-08" });
  });
  it("data inexistente num evento de dia inteiro vira erro, sem derrubar o resto", () => {
    const ruim = ["BEGIN:VEVENT", "UID:r1", "DTSTART;VALUE=DATE:20260230", "SUMMARY:Ruim", "END:VEVENT"].join("\r\n");
    const bom = ["BEGIN:VEVENT", "UID:r2", "DTSTART;VALUE=DATE:20261001", "SUMMARY:Bom", "END:VEVENT"].join("\r\n");
    const r = analisarIcs(ics(ruim + "\r\n" + bom + "\r\n"));
    expect(r.eventos.map((e) => e.titulo)).toEqual(["Bom"]);
    expect(r.erros).toHaveLength(1);
  });
  it("a expansão de eventos longos também respeita o limite", () => {
    const um = (i: number) => ["BEGIN:VEVENT", "UID:l" + i, "DTSTART;VALUE=DATE:20261001", "DTEND;VALUE=DATE:20261031", "SUMMARY:Longo " + i, "END:VEVENT"].join("\r\n");
    const muitos = Array.from({ length: 80 }, (_, i) => um(i)).join("\r\n");
    const r = analisarIcs(ics(muitos + "\r\n"));
    expect(r.eventos).toEqual([]);
    expect(r.erros[0].mensagem).toContain("máximo");
  });
  it("fim antes do início é rejeitado no CSV", () => {
    const csv = ["data,inicio,fim,titulo", "2026-03-01,10:00,09:00,A"].join("\n");
    expect(analisarCsvCalendario(csv).eventos).toEqual([]);
  });
});
