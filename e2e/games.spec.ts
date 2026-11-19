import { expect, test, type Page } from "@playwright/test";

interface GameState {
  phase: string;
  note: string | null;
  idx: number | null;
  answered: number;
  streak: number;
  introduced: number;
  seq: number;
}

async function state(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as any).__stabat.game.state());
}

/** espera a próxima pergunta (ou cartão de nota nova) e devolve o estado */
async function waitCard(page: Page, afterSeq = 0): Promise<GameState> {
  await expect
    .poll(async () => {
      const s = await state(page);
      return s.phase === "end" || (s.seq > afterSeq && ["ask", "intro", "level"].includes(s.phase));
    })
    .toBe(true);
  return state(page);
}

async function start(page: Page, memory?: unknown): Promise<void> {
  if (memory)
    await page.addInitScript((m) => localStorage.setItem("stabat.games.queNota", JSON.stringify(m)), memory);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/jogos/que-nota");
  await page.getByRole("button", { name: "Começar" }).click();
  await waitCard(page);
  expect(errors).toEqual([]);
}

test.describe("Que nota é essa?", () => {
  test("primeira vez: explica, começa com Sol, Fá ou Lá e o acerto conta", async ({ page }) => {
    await page.goto("/jogos/que-nota");
    await expect(page.getByTestId("game-overlay")).toContainText("Toque no nome dela");
    await page.getByRole("button", { name: "Começar" }).click();
    const s = await waitCard(page);
    expect(s.phase).toBe("ask");
    expect(["G4", "F4", "A4"]).toContain(s.note);
    await page.getByTestId(`answer-${s.idx}`).click();
    await expect(page.getByTestId(`answer-${s.idx}`)).toHaveClass(/ans-ok/);
    await expect(page.getByTestId("streak")).toContainText("1");
    // a nota acertada fica colorida (só a parte preta: o furo é vazado no glifo)
    await expect(page.getByTestId("notehead")).not.toHaveAttribute("fill", "#151515");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("stabat.games.queNota")!));
    expect(saved.tick).toBe(1);
  });

  test("erro mostra a resposta certa e a dica, e zera a sequência", async ({ page }) => {
    await start(page);
    const s = await state(page);
    const wrong = (s.idx! + 1) % 7;
    await page.getByTestId(`answer-${wrong}`).click();
    await expect(page.getByTestId(`answer-${wrong}`)).toHaveClass(/ans-bad/);
    await expect(page.getByTestId(`answer-${s.idx}`)).toHaveClass(/ans-reveal/);
    await expect(page.getByTestId("game-hint")).toContainText("Era");
    expect((await state(page)).streak).toBe(0);
  });

  test("rodada inteira com teclado: 10 acertos, 3 estrelas", async ({ page }) => {
    await start(page);
    let s = await state(page);
    while (s.phase !== "end") {
      if (s.phase === "level") {
        await page.getByRole("button", { name: "Vamos lá" }).click();
      } else {
        await page.keyboard.press(String(s.idx! + 1));
      }
      s = await waitCard(page, s.seq);
    }
    await expect(page.getByTestId("game-overlay")).toContainText("Excelente!");
    await expect(page.getByTestId("game-overlay")).toContainText("10/10");
    await page.getByRole("button", { name: "Mais uma rodada" }).click();
    expect((await waitCard(page)).answered).toBe(0);
  });

  test("quem sabe o nível 1 ganha nota nova com cartão de apresentação", async ({ page }) => {
    const notes: Record<string, unknown> = {};
    for (const id of ["G4", "F4", "A4", "B4", "D4", "E4", "C4"])
      notes[id] = { box: 4, seen: 8, ok: 8, last: 0 };
    await start(page, {
      v: 1,
      notes,
      introduced: 7,
      tick: 10,
      recent: Array(10).fill(true),
      confusions: {},
      best: 3,
      lastPlayed: Date.now(),
    });
    const s = await state(page);
    expect(s.phase).toBe("level");
    await expect(page.getByTestId("game-overlay")).toContainText("Nível 2 desbloqueado");
    await page.getByRole("button", { name: "Vamos lá" }).click();
    const intro = await state(page);
    expect(intro).toMatchObject({ phase: "intro", note: "C5" });
    await expect(page.getByTestId("game-hint")).toContainText("Nota nova: Dó");
    await page.getByTestId("answer-0").click();
    const next = await waitCard(page, intro.seq);
    expect(next.phase).toBe("ask");
    expect(next.introduced).toBe(8);
  });

  test("página cabe na tela, sem rolagem para o lado", async ({ page }) => {
    await start(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    const last = (await page.getByTestId("answer-6").boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});
