import { expect, test, type Page } from "@playwright/test";

interface RhythmState {
  phase: string;
  seq: number;
  answered: number;
  streak: number;
  introduced: number;
  level: number;
  cells: string[];
  onsets: number[] | null;
  taps: number[];
  bpm: number;
}

const state = (page: Page): Promise<RhythmState> =>
  page.evaluate(() => (window as any).__stabat.game.state());
const tapAt = (page: Page, sec: number) => page.evaluate((s) => (window as any).__stabat.game.tapAt(s), sec);
const finish = (page: Page) => page.evaluate(() => (window as any).__stabat.game.finish());

/** espera um exercício novo (contagem ou vez do músico), uma apresentação ou o fim */
async function waitCard(page: Page, afterSeq = 0): Promise<RhythmState> {
  await expect
    .poll(async () => {
      const s = await state(page);
      return (
        s.phase === "end" || s.phase === "intro" || (s.seq > afterSeq && ["count", "play"].includes(s.phase))
      );
    })
    .toBe(true);
  return state(page);
}

async function start(page: Page, memory?: unknown): Promise<RhythmState> {
  await page.addInitScript(() => localStorage.setItem("stabat.games.rhythmLatency", "0"));
  if (memory)
    await page.addInitScript((m) => localStorage.setItem("stabat.games.rhythm", JSON.stringify(m)), memory);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/jogos/ritmo");
  await page.getByRole("button", { name: "Começar" }).click();
  const s = await waitCard(page);
  expect(errors).toEqual([]);
  return s;
}

/** toca tudo certo, no tempo exato */
async function playPerfect(page: Page, s: RhythmState): Promise<void> {
  for (const t of s.onsets!) await tapAt(page, t);
  await finish(page);
}

test.describe("Bate o ritmo", () => {
  test("primeira vez: explica, conta 4 3 2 1 e chega a vez do músico", async ({ page }) => {
    await page.goto("/jogos/ritmo");
    await expect(page.getByTestId("game-overlay")).toContainText("4, 3, 2, 1");
    // ainda sem ajuste do atraso: oferece antes de começar
    await expect(page.getByTestId("game-overlay")).toContainText("ajustar o atraso do som");
    await page.getByRole("button", { name: "Começar" }).click();
    const s = await waitCard(page);
    expect(s.level).toBe(1);
    expect(s.bpm).toBe(60);
    // nível 1: só semínima, mínima e semibreve; dois compassos 4/4
    for (const c of s.cells) expect(["q", "h", "w"]).toContain(c);
    await expect(page.getByTestId("rhythm-phase")).toHaveText("Contagem");
    await expect(page.getByTestId("count-in")).toHaveText("4");
    await expect(page.getByTestId("count-in")).toHaveText("3");
    await expect(page.getByTestId("rhythm-phase")).toHaveText("Sua vez!", { timeout: 6000 });
    // nível 1: o cursor anda junto
    await expect.poll(() => page.getByTestId("rhythm-cursor").getAttribute("opacity")).toBe("0.8");
  });

  test("tudo no tempo: notas verdes, “No tempo!”, sequência e memória", async ({ page }) => {
    const s = await start(page);
    await playPerfect(page, s);
    await expect(page.getByTestId("game-hint")).toContainText("No tempo!");
    await expect(page.getByTestId("streak")).toContainText("1");
    await expect(page.getByTestId("tap-mark")).toHaveCount(s.onsets!.length);
    for (const m of await page.getByTestId("tap-mark").all())
      await expect(m).toHaveAttribute("data-state", "ok");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("stabat.games.rhythm")!));
    expect(saved.tick).toBe(1);
  });

  test("um pouco atrasado ainda vale, com “tarde”; nota que falta e toque a mais não", async ({ page }) => {
    let s = await start(page);
    const [first, ...rest] = s.onsets!;
    await tapAt(page, first! + 0.1);
    for (const t of rest) await tapAt(page, t);
    await finish(page);
    await expect(page.getByTestId("game-hint")).toContainText("Certo!");
    await expect(page.getByTestId("rhythm-staff").getByText("tarde")).toBeVisible();

    s = await waitCard(page, s.seq);
    // pula a 2ª nota
    for (const [i, t] of s.onsets!.entries()) if (i !== 1) await tapAt(page, t);
    await finish(page);
    await expect(page.getByTestId("game-hint")).toContainText("Faltou a 2ª nota");
    expect((await state(page)).streak).toBe(0);

    s = await waitCard(page, s.seq);
    for (const t of s.onsets!) await tapAt(page, t);
    await tapAt(page, s.onsets!.at(-1)! + 0.5);
    await finish(page);
    await expect(page.getByTestId("game-hint")).toContainText("Toque a mais");
    await expect(page.locator('[data-testid=tap-mark][data-state="bad"]')).toHaveCount(1);
  });

  test("rodada inteira certa: 3 estrelas, e o andamento escolhido fica lembrado", async ({ page }) => {
    let s = await start(page);
    while (s.phase !== "end") {
      if (s.phase === "intro") await page.getByRole("button", { name: "Vamos lá" }).click();
      else await playPerfect(page, s);
      s = await waitCard(page, s.seq);
    }
    await expect(page.getByTestId("game-overlay")).toContainText("Excelente!");
    await expect(page.getByTestId("game-overlay")).toContainText("10/10");

    // o andamento se escolhe também na tela final e na de entrada
    const overlay = page.getByTestId("game-overlay");
    await overlay.getByRole("button", { name: "Mais rápido" }).click();
    await expect(overlay.getByTestId("rhythm-bpm")).toHaveText("70 bpm");
    await page.reload();
    await expect(overlay.getByTestId("rhythm-bpm")).toHaveText("70 bpm");
    await page.getByRole("button", { name: "Começar" }).click();
    expect((await waitCard(page)).bpm).toBe(70);
  });

  test("quem domina o nível 1 ganha ritmo novo; nível 2 traz pausas", async ({ page }) => {
    const firm = { box: 4, seen: 8, ok: 8, last: 0 };
    let s = await start(page, {
      v: 1,
      cells: { q: firm, h: firm, w: firm, hd: firm },
      introduced: 4,
      tick: 20,
      recent: Array(10).fill(true),
      best: 3,
      lastPlayed: Date.now(),
    });
    expect(s.phase).toBe("intro");
    await expect(page.getByTestId("game-overlay")).toContainText("Nível 2 desbloqueado");
    await expect(page.getByTestId("game-overlay")).toContainText("Pausa de semínima");
    await page.getByRole("button", { name: "Vamos lá" }).click();
    s = await waitCard(page, s.seq);
    expect(s.level).toBe(2);
    expect(s.cells).toContain("rq");
    // tocar na pausa é toque a mais
    await expect(page.getByTestId("rest").first()).toBeVisible();
    // a partir do nível 2, o cursor não aparece
    await expect(page.getByTestId("rhythm-phase")).toHaveText("Sua vez!", { timeout: 6000 });
    await page.waitForTimeout(300);
    await expect(page.getByTestId("rhythm-cursor")).toHaveAttribute("opacity", "0");
  });

  test("ajuste do atraso: tocando junto com os cliques, guarda a correção", async ({ page }) => {
    await page.goto("/jogos/ritmo");
    await page.getByRole("button", { name: /ajustar o atraso do som/ }).click();
    await page.getByRole("button", { name: "Começar" }).click();
    const pad = page.getByTestId("calibrate-pad");
    await expect(pad).toBeVisible();
    // 4 de contagem + 8 cliques a 80 bpm (0,75 s): toca mais ou menos junto
    await page.waitForTimeout(400 + 4 * 750);
    for (let i = 0; i < 8; i++) {
      await pad.dispatchEvent("pointerdown");
      await page.waitForTimeout(750);
    }
    await expect(page.getByTestId("game-overlay")).toContainText("ms", { timeout: 4000 });
    await expect(page.getByTestId("game-overlay")).not.toContainText("Poucos toques");
    const saved = await page.evaluate(() => localStorage.getItem("stabat.games.rhythmLatency"));
    expect(Number.isFinite(Number(saved))).toBe(true);
    await page.getByRole("button", { name: "Voltar ao jogo" }).click();
    await expect(page.getByTestId("game-overlay")).toContainText("ms)");
    await expect(page.getByTestId("calibrate-open")).toContainText("ms)");
  });

  test("página cabe na tela, botão de tocar visível sem rolar", async ({ page }) => {
    await start(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    const pad = (await page.getByTestId("rhythm-pad").boundingBox())!;
    expect(pad.y + pad.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});
