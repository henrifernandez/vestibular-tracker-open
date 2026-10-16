import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatarDia, hojeEmSaoPaulo } from "@/lib/datas";

// Datas do app são "dias puros", guardados como meia-noite UTC. Formatadas no fuso do navegador
// (Brasília, UTC−3), 07/10 apareceria como 06/10. Estes testes rodam no fuso de Brasília de propósito.
describe("datas em fuso diferente de UTC", () => {
  const TZ_ORIGINAL = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Sao_Paulo";
  });
  afterAll(() => {
    if (TZ_ORIGINAL === undefined) delete process.env.TZ;
    else process.env.TZ = TZ_ORIGINAL;
  });

  const diaDoBanco = new Date("2026-10-07T00:00:00.000Z");

  it("o ambiente do teste está mesmo em Brasília (a formatação ingênua desloca o dia)", () => {
    expect(diaDoBanco.toLocaleDateString("pt-BR")).toBe("06/10/2026");
  });

  it("formatarDia mantém o dia gravado, qualquer que seja o fuso", () => {
    expect(formatarDia(diaDoBanco)).toBe("07/10/2026");
    expect(formatarDia("2026-10-07T00:00:00.000Z")).toBe("07/10/2026");
    expect(formatarDia("2026-01-01")).toBe("01/01/2026");
  });

  it("hojeEmSaoPaulo usa o dia de Brasília, não o de UTC (sexta à noite não vira sábado)", () => {
    // 22h de sexta em Brasília = 01h de sábado em UTC
    expect(hojeEmSaoPaulo(new Date("2026-10-17T01:00:00.000Z"))).toBe("2026-10-16");
  });
});
