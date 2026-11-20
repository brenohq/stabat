import { expect, type Page } from "@playwright/test";

/** estado do motor de áudio da página (via window.__stabat, exposto com VITE_DEBUG=1) */
interface EngineState {
  loaded: boolean;
  loading: boolean;
  waiting: boolean;
  playing: boolean;
  pos: number;
  rate: number;
  metronome: boolean;
  countIn: boolean;
  loop: [number, number] | null;
  measure: number;
  level: number;
  /** arquivos de áudio pedidos ao motor, sem a pasta (ex.: "tutti.mp3") */
  files: string[];
  gains: number[];
}

export async function engine(page: Page): Promise<EngineState> {
  return page.evaluate(() => {
    const p = (window as unknown as { __stabat?: { page?: Record<string, any> } }).__stabat?.page;
    if (!p) throw new Error("window.__stabat.page ausente");
    const e = p.engine;
    return {
      loaded: e.loaded,
      loading: e.loading,
      waiting: e.waiting,
      playing: e.playing,
      pos: Math.round(e.now()),
      rate: e.rate,
      metronome: e.metronome,
      countIn: e.countIn,
      loop: e.loop,
      measure: p.timeline.at(e.now()).m,
      level: e.level(),
      files: e.tracks().map((t: { file: string }) => t.file),
      gains: e.tracks().map((t: { gain: number }) => t.gain),
    };
  });
}

/** abre a página do arranjo ou da parte e espera a partitura e o motor (o áudio só vem no play) */
export async function openPlayer(page: Page, path: string): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await expect.poll(async () => (await engine(page).catch(() => null)) !== null).toBe(true);
  await expect(page.getByTestId("score").locator("g.measure").first()).toBeVisible();
  expect(errors, "erros de JavaScript na página").toEqual([]);
}

/** aperta o play e espera o áudio baixar e começar a tocar */
export async function play(page: Page): Promise<void> {
  await page.locator("#play").click();
  // arranjos longos (Abba Gold, 6min45s) demoram a baixar e decodificar com os testes em paralelo
  await expect
    .poll(
      async () => {
        const e = await engine(page);
        return e.loaded && e.playing;
      },
      { timeout: 45_000 },
    )
    .toBe(true);
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

/** escolhe uma parte no seletor (PartPicker): abre a lista e clica na opção */
export async function pickPart(page: Page, trigger: string, partId: string) {
  await page.locator(trigger).click();
  await page.locator(`[role=option][data-part="${partId}"]`).click();
}
