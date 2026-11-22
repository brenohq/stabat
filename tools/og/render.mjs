/**
 * Gera public/og/que-nota.png (1200×630): a miniatura do link do jogo no WhatsApp e afins.
 * Usa a clave e a semibreve do próprio jogo (bravura.ts, as do NoteStaff) e as fontes do site.
 * Uso: npm run og
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const staff = readFileSync(resolve(root, "src/components/games/bravura.ts"), "utf8");
const glyph = (name) => staff.match(new RegExp(`const ${name} =\\s*"([^"]+)"`))[1];
const CLEF = glyph("CLEF");
const WHOLE = glyph("WHOLE");

const NAMES = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const COLORS = ["#d64541", "#e8822a", "#d4a514", "#3f9d4f", "#22a09c", "#3b74cc", "#8a52c4"];
const ANSWER = 4; // Sol, na 2ª linha

// pauta: espaço s, passo 0 = 1ª linha
const s = 26;
const W = 820;
const top = 11;
const bottom = -2;
const margin = 18;
const H = margin * 2 + (top - bottom) * (s / 2);
const y = (step) => margin + (top - step) * (s / 2);
const k = s / 250;
const noteX = 470;
const head = 422 * k;
const lines = [0, 2, 4, 6, 8]
  .map((st) => `<line x1="8" x2="${W - 8}" y1="${y(st)}" y2="${y(st)}" stroke="#151515" stroke-width="2"/>`)
  .join("");
const sparkles = [
  ["♪", -100, -64, -18, 44],
  ["♫", 72, -74, 14, 40],
  ["♩", 112, -12, 22, 36],
  ["♬", -124, 10, -10, 38],
  ["♪", 26, -100, 8, 32],
]
  .map(
    ([g, dx, dy, r, size], i) =>
      `<text x="${noteX + dx}" y="${y(2) + dy}" font-size="${size}" fill="${COLORS[(i + 2) % 7]}" transform="rotate(${r} ${noteX + dx} ${y(2) + dy})" font-family="'Noto Music','DejaVu Sans',sans-serif">${g}</text>`,
  )
  .join("");

const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${lines}
  <path d="${CLEF}" fill="#151515" transform="translate(${s * 0.75} ${y(2)}) scale(${k} ${-k})"/>
  <circle cx="${noteX}" cy="${y(2)}" r="${s * 1.6}" fill="${COLORS[ANSWER]}" opacity=".14"/>
  <path d="${WHOLE}" fill="${COLORS[ANSWER]}" transform="translate(${noteX - head / 2} ${y(2)}) scale(${k} ${-k})"/>
  ${sparkles}
  <text x="${noteX + 46}" y="${y(2) - 30}" font-family="Fraunces Variable" font-weight="700" font-size="34" fill="#2f8a57">+1</text>
</svg>`;

const buttons = NAMES.map(
  (n, i) => `<div class="btn${i === ANSWER ? " ok" : ""}" style="border-bottom-color:${COLORS[i]}">
    <b>${n}</b><span>${LETTERS[i]}</span></div>`,
).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/fraunces/index.css">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/inter/index.css">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "Inter Variable", sans-serif;
    background: radial-gradient(circle at 50% 38%, #2b3a5e 0%, #1f2a44 55%, #151d31 100%); color: #f3eee4;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; position: relative; }
  .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #e0aa45; display: flex; align-items: center; gap: 12px; }
  .eyebrow i { width: 34px; height: 2px; background: #e0aa45; opacity: .6; }
  h1 { font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 76px; line-height: 1; letter-spacing: -.01em; }
  .paper { background: #fffdf8; border-radius: 22px; padding: 6px 10px; box-shadow: 0 18px 50px rgb(0 0 0 / .35); position: relative; }
  .streak { position: absolute; top: -18px; right: -22px; background: #a8761c; color: #fff; font-weight: 700; font-size: 22px;
    padding: 8px 16px; border-radius: 999px; box-shadow: 0 8px 20px rgb(0 0 0 / .3); transform: rotate(4deg); border: 3px solid #f3eee4; }
  .row { display: flex; gap: 12px; }
  .btn { width: 104px; height: 82px; border-radius: 16px; background: #faf7f1; color: #1b2130; border: 3px solid #e3dccf; border-bottom-width: 9px;
    display: grid; place-items: center; align-content: center; }
  .btn b { font-family: "Fraunces Variable", serif; font-size: 30px; font-weight: 650; line-height: 1.05; }
  .btn span { font-size: 15px; font-weight: 700; color: #687082; letter-spacing: .06em; }
  .btn.ok { background: #dff1e6; border-color: #2f8a57; transform: translateY(-6px) scale(1.06); box-shadow: 0 0 0 7px rgb(47 138 87 / .35); }
  .site { position: absolute; right: 30px; bottom: 22px; font-size: 20px; opacity: .7; font-weight: 500; }
</style></head><body>
  <div class="eyebrow"><i></i>stabat · jogo de leitura<i></i></div>
  <h1>Que nota é essa?</h1>
  <div class="paper">${svg}<div class="streak">7 seguidas!</div></div>
  <div class="row">${buttons}</div>
  <div class="site">stabat.com.br</div>
</body></html>`;

const out = resolve(root, "public/og/que-nota.png");
mkdirSync(dirname(out), { recursive: true });
const tmp = resolve(root, "test-results/og-que-nota.html");
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, html);
const browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`gerado: ${out}`);
