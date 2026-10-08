// Capturas de tela em 375, 768 e 1280 px e auditoria de acessibilidade (axe) das telas principais.
// Uso (com o app rodando em modo demonstração): BASE_URL=http://localhost:3100 npx tsx scripts/auditoria-visual.ts
// Se o Chromium do Playwright não estiver instalado: npx playwright install chromium
// ou aponte CHROMIUM_PATH para um Chrome/Chromium existente.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const SAIDA = process.env.SAIDA ?? "capturas"; // docs/capturas guarda só as 3 imagens do README (copie de lá)
const LARGURAS = [375, 768, 1280];
const ROTAS = [
  ["painel", "/"],
  ["resumo", "/resumo"],
  ["simulados", "/simulados"],
  ["revisao", "/revisao"],
  ["calendario", "/calendario"],
  ["provas", "/provas"],
  ["prova", "/provas/enem-exemplo"],
] as const;

async function main() {
  mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let criticas = 0;
  let cortes = 0;

  for (const [nome, rota] of ROTAS) {
    for (const largura of LARGURAS) {
      const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
      const page = await contexto.newPage();
      await page.goto(BASE + rota, { waitUntil: "networkidle" });
      if (rota === "/") await page.locator("button[aria-expanded]").first().click(); // abre a primeira prova do painel
      await page.waitForTimeout(500);

      const transborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (transborda) {
        cortes++;
        console.log(`  ! ${nome} ${largura}px: rolagem horizontal na página`);
      }
      await page.screenshot({ path: `${SAIDA}/${nome}-${largura}.png`, fullPage: true });

      if (largura !== 768) {
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations) {
          if (v.impact === "critical") criticas++;
          console.log(`  [${v.impact}] ${nome} ${largura}px: ${v.id} (${v.nodes.length}) ${v.help}`);
        }
        if (r.violations.length === 0) console.log(`  ok ${nome} ${largura}px: sem violações`);
      }
      await contexto.close();
    }
  }
  await browser.close();
  console.log(`\nViolações críticas: ${criticas}. Telas com rolagem horizontal: ${cortes}.`);
  process.exit(criticas > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
