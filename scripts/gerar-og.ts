// Gera public/og-image.png (1200x630), a imagem de pré-visualização ao compartilhar o link.
// Uso: CHROMIUM_PATH=... npx tsx scripts/gerar-og.ts
import { chromium } from "playwright";

const html = `<html><body style="margin:0;width:1200px;height:630px;background:#0D1211;color:#E8EEEB;font-family:Georgia,serif;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="font-size:30px;color:#6CC4B6;font-family:system-ui,sans-serif;letter-spacing:2px;text-transform:uppercase">Código aberto</div>
<div style="font-size:92px;font-weight:600;margin-top:18px;line-height:1.05">Vestibular Tracker</div>
<div style="font-size:36px;color:#B9C4C0;margin-top:26px;font-family:system-ui,sans-serif;max-width:900px">Simulados, revisão por erros, plano de estudo e calendário para vestibulares e ENEM.</div>
<svg width="320" height="90" viewBox="0 0 320 90" style="margin-top:44px"><path d="M4 76 70 40l50 28 70-52 60 30 66-40" fill="none" stroke="#6CC4B6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html);
  await p.screenshot({ path: "public/og-image.png" });
  await b.close();
})();
