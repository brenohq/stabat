import { expect, type Page } from "@playwright/test";

/** estado do motor de áudio da página (via window.__stabat, exposto com VITE_DEBUG=1) */
export interface EngineState {
  loaded: boolean;
  playing: boolean;
  pos: number;
  rate: number;
  metronome: boolean;
  countIn: boolean;
  loop: [number, number] | null;
  measure: number;
  level: number;
  gains: number[];
}

export async function engine(page: Page): Promise<EngineState> {
  return page.evaluate(() => {
    const p = (window as unknown as { __stabat?: { page?: Record<string, any> } }).__stabat?.page;
    if (!p) throw new Error("window.__stabat.page ausente");
    const e = p.engine;
    return {
      loaded: e.loaded,
      playing: e.playing,
      pos: Math.round(e.now()),
      rate: e.rate,
      metronome: e.metronome,
      countIn: e.countIn,
      loop: e.loop,
      measure: p.timeline.at(e.now()).m,
      level: e.level(),
      gains: e.gains(),
    };
  });
}

/** abre a página e espera áudio e partitura prontos */
export async function openLoaded(page: Page, path: string): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await expect.poll(async () => (await engine(page).catch(() => null))?.loaded ?? false).toBe(true);
  await expect(page.getByTestId("score").locator("g.measure").first()).toBeVisible();
  expect(errors, "erros de JavaScript na página").toEqual([]);
}

/** clica no compasso m (0 = primeiro) da partitura */
export async function clickMeasure(page: Page, m: number): Promise<void> {
  await page.getByTestId("score").locator("g.measure").nth(m).click({ force: true });
}

/** espera som (ou silêncio) na saída */
export async function expectSound(page: Page, audible: boolean): Promise<void> {
  const level = expect.poll(async () => (await engine(page)).level, {
    message: audible ? "esperava som" : "esperava silêncio",
  });
  if (audible) await level.toBeGreaterThan(0.01);
  else await level.toBeLessThan(0.002);
}

/** escala do Verovio aplicada à partitura agora */
export async function scoreScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const v = (window as unknown as { __stabat: { page: { view: { lastKey: string } } } }).__stabat.page.view;
    return Number(v.lastKey.split("/")[1]);
  });
}
