/**
 * Gera public/og/home.png (1200×630): a miniatura do link do site (stabat.com.br) no WhatsApp e afins.
 * Leque com as capas dos arranjos publicados (mesmo gradiente e pauta dos cartões da home).
 * Uso: npm run og
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const all = JSON.parse(readFileSync(resolve(root, "public/arranjos/index.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const icon = readFileSync(resolve(root, "public/icon.svg"), "utf8").match(/ d="([^"]+)"/)[1];

// até 5 capas, em leque; a do meio fica na frente
const N = Math.min(5, all.length);
const picks = all.slice(0, N);
const mid = (N - 1) / 2;
const order = picks.map((_, i) => i).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid));

const cover = (a, i) => {
  const [h1, h2] = a.hue ?? [40, 220];
  const off = i - mid;
  const lines = [0, 1, 2, 3, 4].map((l) => `<i style="top:${62 + l * 13}px"></i>`).join("");
  return `<div class="card" style="--r:${off * 7}deg;--x:${off * 222}px;--y:${Math.abs(off) ** 1.7 * 16}px;
    background:linear-gradient(100deg,hsl(${h1} 55% 42%),hsl(${h2} 50% 30%))">
    ${lines}
    <div class="badges"><span>${a.tempo} bpm</span><span>${a.time}</span></div>
    <h2>${esc(a.title)}</h2>
    <p>${esc(a.subtitle)}</p>
  </div>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/fraunces/index.css">
<link rel="stylesheet" href="file://${root}/node_modules/@fontsource-variable/inter/index.css">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: "Inter Variable", sans-serif; position: relative;
    background: radial-gradient(ellipse at 50% 20%, #2b3a5e 0%, #1f2a44 55%, #151d31 100%); color: #f3eee4; }
  header { position: absolute; top: 40px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .brand { display: flex; align-items: center; gap: 12px; font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 34px; color: #f3eee4; }
  .brand svg { width: 40px; height: 40px; }
  h1 { font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 74px; line-height: 1; letter-spacing: -.01em; }
  h1 em { font-style: normal; color: #e0aa45; }
  .sub { font-size: 26px; color: #c9cfdc; }
  .fan { position: absolute; left: 600px; top: 268px; }
  .card { position: absolute; width: 250px; height: 190px; left: -125px; top: 0; border-radius: 18px; overflow: hidden; padding: 16px 20px;
    transform: translate(var(--x), var(--y)) rotate(var(--r)); transform-origin: 50% 200%;
    box-shadow: 0 18px 40px rgb(0 0 0 / .45), inset 0 0 0 1px rgb(255 255 255 / .12); }
  .card i { position: absolute; left: 0; right: 0; height: 1.5px; background: rgb(255 255 255 / .2); }
  .badges { position: relative; display: flex; gap: 6px; }
  .badges span { font-size: 14px; font-weight: 600; color: rgb(255 255 255 / .92); background: rgb(0 0 0 / .25); border: 1px solid rgb(255 255 255 / .22);
    border-radius: 999px; padding: 3px 10px; }
  .card h2 { position: relative; margin-top: 50px; font-family: "Fraunces Variable", serif; font-weight: 650; font-size: 30px; line-height: 1.05; color: #fff;
    text-shadow: 0 2px 10px rgb(0 0 0 / .3); white-space: nowrap; }
  .card p { position: relative; margin-top: 6px; font-size: 16px; color: rgb(255 255 255 / .8); white-space: nowrap; }
  .player { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); display: flex; align-items: center; gap: 18px;
    background: #fffdf8; color: #1b2130; border-radius: 999px; padding: 10px 28px 10px 10px; box-shadow: 0 16px 40px rgb(0 0 0 / .45); }
  .play { width: 64px; height: 64px; border-radius: 50%; background: #a8761c; display: grid; place-items: center; box-shadow: 0 6px 16px rgb(168 118 28 / .45); }
  .play svg { width: 26px; height: 26px; margin-left: 4px; }
  .mix { display: flex; flex-direction: column; gap: 7px; }
  .mix div { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; }
  .mix b { width: 128px; }
  .bar { width: 170px; height: 8px; border-radius: 99px; background: #e6e0d4; overflow: hidden; }
  .bar u { display: block; height: 100%; background: #1f2a44; }
  .mix .you b { color: #2f5bb7; }
  .mix .you u { background: #3b74cc; }
  .mix small { font-size: 15px; color: #687082; font-weight: 600; width: 40px; text-align: right; }
</style></head><body>
  <header>
    <div class="brand"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#a8761c"/><path transform="translate(4 4)" fill="#fffdf8" d="${icon}"/></svg>stabat</div>
    <h1>Repertório da <em>banda</em></h1>
    <div class="sub">Ouça a banda inteira e estude a sua parte em casa</div>
  </header>
  <div class="fan">${order.map((i) => cover(picks[i], i)).join("")}</div>
  <div class="player">
    <div class="play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="#fff"/></svg></div>
    <div class="mix">
      <div class="you"><b>Minha parte</b><span class="bar"><u style="width:90%"></u></span><small>90%</small></div>
      <div><b>Banda</b><span class="bar"><u style="width:10%"></u></span><small>10%</small></div>
    </div>
  </div>
</body></html>`;

const out = resolve(root, "public/og/home.png");
mkdirSync(dirname(out), { recursive: true });
const tmp = resolve(root, "test-results/og-home.html");
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, html);
const browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${tmp}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`gerado: ${out}`);
