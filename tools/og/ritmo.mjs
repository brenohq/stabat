/**
 * Gera public/og/ritmo.png (1200×630): a miniatura do link do "Bate o ritmo" no WhatsApp e afins.
 * Usa os glifos da Bravura do próprio jogo (bravura.ts) e as fontes do site.
 * Uso: npm run og
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(resolve(root, "src/components/games/bravura.ts"), "utf8");
const glyph = (name) => src.match(new RegExp(`const ${name} =\\s*"([^"]+)"`))[1];
const HEAD = glyph("HEAD_BLACK");
const CLEF = glyph("CLEF");
const FOUR = glyph("TIME_SIG_4");
const REST = glyph("REST_QUARTER");

const INK = "#151515";
const OK = "#2f8a57";
const COLORS = ["#d64541", "#e8822a", "#d4a514", "#3f9d4f", "#22a09c", "#3b74cc", "#8a52c4"];

// pauta de cinco linhas, todas as notas no Lá; um compasso: semínima, duas colcheias, quatro semicolcheias, pausa de semínima (posições em semicolcheias)
const S = 22;
const k = S / 250;
const W = 880;
const BASE = 176; // 1ª linha
const y = (step) => BASE - step * (S / 2);
const LY = y(3); // Lá, 2º espaço
const RY = BASE + 52;
const H = RY + 46;
const X0 = 170;
const X1 = 830;
const x = (on) => X0 + (on / 16) * (X1 - X0);
const headW = 295 * k;
const stemH = 3.5 * S;
const stemW = 0.12 * S;
const notes = [{ on: 0 }, { on: 4 }, { on: 6 }, { on: 8 }, { on: 9 }, { on: 10 }, { on: 11 }];
const g = (d, gx, gy, fill = INK) =>
  `<path d="${d}" fill="${fill}" transform="translate(${gx} ${gy}) scale(${k} ${-k})"/>`;
const stemX = (on) => x(on) + headW / 2;
let svg = [0, 2, 4, 6, 8]
  .map((st) => `<line x1="10" x2="${X1 + 30}" y1="${y(st)}" y2="${y(st)}" stroke="${INK}" stroke-width="2"/>`)
  .join("");
svg += g(CLEF, 20, y(2));
svg += g(FOUR, 112 - (470 * k) / 2, y(6)) + g(FOUR, 112 - (470 * k) / 2, y(2));
svg += `<line x1="${X1 + 20}" x2="${X1 + 20}" y1="${y(8)}" y2="${y(0)}" stroke="${INK}" stroke-width="2"/><rect x="${X1 + 25}" y="${y(8)}" width="8" height="${4 * S}" fill="${INK}"/>`;
for (const n of notes) {
  svg += g(HEAD, x(n.on) - headW / 2, LY, OK);
  svg += `<rect x="${stemX(n.on) - stemW}" y="${LY - stemH}" width="${stemW}" height="${stemH - 4}" fill="${OK}"/>`;
}
const beam = (a, b, dy = 0) =>
  `<rect x="${stemX(a) - stemW}" y="${LY - stemH + dy}" width="${stemX(b) - stemX(a) + stemW}" height="${S * 0.5}" fill="${INK}"/>`;
svg += beam(4, 6) + beam(8, 11) + beam(8, 11, S * 0.75);
svg += g(REST, x(12) - (282 * k) / 2, y(4));
// régua dos tempos com os toques (todos no tempo)
svg += `<line x1="${X0 - 20}" x2="${X1}" y1="${RY}" y2="${RY}" stroke="#d9d1c2" stroke-width="3"/>`;
for (let b = 0; b < 4; b++)
  svg += `<line x1="${x(b * 4)}" x2="${x(b * 4)}" y1="${RY - 8}" y2="${RY + 8}" stroke="#8a8577" stroke-width="3"/><text x="${x(b * 4)}" y="${RY + 34}" text-anchor="middle" font-family="Inter Variable" font-weight="600" font-size="22" fill="#8a8577">${b + 1}</text>`;
for (const n of notes) svg += `<circle cx="${x(n.on)}" cy="${RY}" r="9" fill="${OK}"/>`;
// notinhas comemorando
svg += [
  ["♪", 245, 75, -16, 40],
  ["♫", 600, 40, 12, 38],
  ["♬", 740, 70, 18, 36],
]
  .map(
    ([t, tx, ty, r, size], i) =>
      `<text x="${tx}" y="${ty}" font-size="${size}" fill="${COLORS[(i * 2 + 1) % 7]}" transform="rotate(${r} ${tx} ${ty})" font-family="'Noto Music','DejaVu Sans',sans-serif">${t}</text>`,
  )
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/fraunces/index.css">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/inter/index.css">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "Inter Variable", sans-serif;
    background: radial-gradient(circle at 50% 38%, #2b3a5e 0%, #1f2a44 55%, #151d31 100%); color: #f3eee4;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; position: relative; }
  .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #e0aa45; display: flex; align-items: center; gap: 12px; }
  .eyebrow i { width: 34px; height: 2px; background: #e0aa45; opacity: .6; }
  h1 { font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 80px; line-height: 1; letter-spacing: -.01em; }
  .paper { background: #fffdf8; border-radius: 22px; padding: 4px 12px; box-shadow: 0 18px 50px rgb(0 0 0 / .35); position: relative; }
  .badge { position: absolute; top: -18px; right: -22px; background: #2f8a57; color: #fff; font-family: "Fraunces Variable", serif; font-weight: 700; font-size: 26px;
    padding: 6px 18px; border-radius: 999px; box-shadow: 0 8px 20px rgb(0 0 0 / .3); transform: rotate(4deg); border: 3px solid #f3eee4; }
  .count { position: absolute; top: -20px; left: -20px; display: flex; gap: 8px; }
  .count span { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-family: "Fraunces Variable", serif;
    font-weight: 700; font-size: 24px; background: #f3eee4; color: #1f2a44; border: 3px solid #1f2a44; box-shadow: 0 6px 14px rgb(0 0 0 / .25); }
  .count span:last-child { background: #a8761c; border-color: #f3eee4; color: #fff; }
  .site { position: absolute; right: 30px; bottom: 22px; font-size: 20px; opacity: .7; font-weight: 500; }
</style></head><body>
  <div class="eyebrow"><i></i>stabat · jogo de ritmo<i></i></div>
  <h1>Bate o ritmo</h1>
  <div class="paper">
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>
    <div class="count"><span>4</span><span>3</span><span>2</span><span>1</span></div>
    <div class="badge">No tempo!</div>
  </div>
  <div class="site">stabat.com.br</div>
</body></html>`;

const out = resolve(root, "public/og/ritmo.png");
mkdirSync(dirname(out), { recursive: true });
const tmp = resolve(root, "test-results/og-ritmo.html");
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, html);
const browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`gerado: ${out}`);
