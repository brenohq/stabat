/**
 * Gera public/og/afinador.png (1200×630): a miniatura do link do Afinador no WhatsApp e afins.
 * Um mostrador de ponteiro, como o da página, com o trompete afinado no Si (Lá de concerto).
 * Uso: npm run og
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OK = "#2f8a57";
const WARN = "#e8b63a";
const BAD = "#c0543c";
const MUTED = "#8a8577";

// ponteiro: ±50 cents = ±60°
const W = 560;
const cx = W / 2;
const cy = 300;
const r = 240;
const at = (c, rr) => {
  const a = ((c / 50) * 60 * Math.PI) / 180;
  return [cx + Math.sin(a) * rr, cy - Math.cos(a) * rr];
};
const arc = (c0, c1, color) => {
  const [x0, y0] = at(c0, r + 14);
  const [x1, y1] = at(c1, r + 14);
  return `<path d="M${x0} ${y0} A${r + 14} ${r + 14} 0 0 1 ${x1} ${y1}" stroke="${color}" stroke-width="14" fill="none" opacity=".5"/>`;
};
let svg = arc(-50, -25, BAD) + arc(-25, -10, WARN) + arc(-10, 10, OK) + arc(10, 25, WARN) + arc(25, 50, BAD);
for (let c = -50; c <= 50; c += 5) {
  const big = c % 25 === 0;
  const [x0, y0] = at(c, r - (big ? 26 : 13));
  const [x1, y1] = at(c, r);
  svg += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${MUTED}" stroke-width="${big ? 4 : 2}"/>`;
}
const [nx, ny] = at(2, r - 8);
svg += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${OK}" stroke-width="8" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="16" fill="${OK}"/>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/fraunces/index.css">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/inter/index.css">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "Inter Variable", sans-serif;
    background: radial-gradient(circle at 30% 40%, #2b3a5e 0%, #1f2a44 55%, #151d31 100%); color: #f3eee4;
    display: flex; align-items: center; justify-content: center; gap: 56px; position: relative; padding: 0 60px; }
  .text { display: flex; flex-direction: column; gap: 22px; max-width: 470px; }
  .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #e0aa45; display: flex; align-items: center; gap: 12px; }
  .eyebrow i { width: 34px; height: 2px; background: #e0aa45; opacity: .6; }
  h1 { font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 96px; line-height: 1; letter-spacing: -.01em; }
  p { font-size: 28px; line-height: 1.35; opacity: .8; }
  .paper { background: #fffdf8; border-radius: 26px; padding: 30px 26px 26px; box-shadow: 0 18px 50px rgb(0 0 0 / .35);
    display: flex; flex-direction: column; align-items: center; color: #1b2130; position: relative; }
  .who { font-size: 18px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: ${MUTED}; }
  .note { font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 92px; line-height: 1; color: ${OK}; }
  .bar { width: 64px; height: 6px; border-radius: 3px; background: #8a52c4; margin: 8px 0 0; }
  .badge { position: absolute; bottom: 26px; background: ${OK}; color: #fff; font-family: "Fraunces Variable", serif; font-weight: 700; font-size: 28px;
    padding: 6px 22px; border-radius: 999px; }
  .site { position: absolute; right: 30px; bottom: 22px; font-size: 20px; opacity: .7; font-weight: 500; }
</style></head><body>
  <div class="text">
    <div class="eyebrow"><i></i>stabat</div>
    <h1>Afinador</h1>
    <p>A banda afina no Lá de concerto. Cada músico vê a nota que ele lê e o que mexer no instrumento.</p>
  </div>
  <div class="paper">
    <div class="who">Trompete Sib · toque</div>
    <div class="note">Si</div>
    <div class="bar"></div>
    <svg viewBox="0 0 ${W} 330" width="${W}" height="330">${svg}</svg>
    <div class="badge">Afinado!</div>
  </div>
  <div class="site">stabat.com.br</div>
</body></html>`;

const out = resolve(root, "public/og/afinador.png");
mkdirSync(dirname(out), { recursive: true });
const tmp = resolve(root, "test-results/og-afinador.html");
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, html);
const browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`gerado: ${out}`);
