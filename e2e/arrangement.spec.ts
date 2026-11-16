import { expect, test } from "@playwright/test";
import { clickMeasure, engine, expectSound, openLoaded, scoreScale } from "./helpers";

test.describe("página do arranjo", () => {
  test.beforeEach(async ({ page }) => openLoaded(page, "/teste"));

  test("play toca e o pause para de verdade", async ({ page }) => {
    await page.locator("#play").click();
    await expect.poll(async () => (await engine(page)).pos).toBeGreaterThan(500);
    await expectSound(page, true);
    await page.locator("#play").click();
    const a = await engine(page);
    expect(a.playing).toBe(false);
    await page.waitForTimeout(400);
    expect((await engine(page)).pos).toBe(a.pos);
    await expectSound(page, false);
    await expect(page.locator("#play")).toHaveAttribute("aria-label", "Tocar");
  });

  test("clique no compasso toca dali, respeitando o ritornelo", async ({ page }) => {
    await clickMeasure(page, 4); // compasso 5: só aparece depois da repetição (7º tocado → 12 s)
    await expect.poll(async () => (await engine(page)).pos).toBeGreaterThanOrEqual(12000);
    expect((await engine(page)).measure).toBe(4);
    await expect(page.getByTestId("measure")).toHaveText("5");
    await page.locator("#play").click();
    await clickMeasure(page, 2); // compasso 3: ocorrência mais próxima (2ª vez, 8 s)
    const s = await engine(page);
    expect(s.pos).toBeGreaterThanOrEqual(8000);
    expect(s.pos).toBeLessThan(10000);
  });

  test("botões de ensaio pulam para a letra", async ({ page }) => {
    await page.getByTestId("sections").getByRole("button", { name: "B" }).click();
    await expect.poll(async () => (await engine(page)).measure).toBe(4);
  });

  test("metrônomo começa ligado", async ({ page }) => {
    await expect(page.locator("#metro")).toHaveAttribute("aria-pressed", "true");
    expect((await engine(page)).metronome).toBe(true);
  });

  test("desligar família apaga as pautas e zera o volume; solo isola", async ({ page }) => {
    const wood = page.locator('details[data-family="wood"]');
    await wood.getByRole("switch").click();
    await expect(wood.getByTestId("family-count")).toHaveText("0/1");
    await expect.poll(async () => (await engine(page)).gains).toEqual([0, 1]);
    await expect(page.locator("g.staff.muted")).toHaveCount(6);
    await page.getByRole("button", { name: "todos" }).click();
    await expect.poll(async () => (await engine(page)).gains).toEqual([1, 1]);
    const brass = page.locator('details[data-family="brass-lo"]');
    await brass.locator("summary").click(); // abre o grupo
    await brass.getByRole("button", { name: /Solo/ }).click();
    await expect.poll(async () => (await engine(page)).gains).toEqual([0, 1]);
  });

  test("famílias começam fechadas e lembram o que foi aberto", async ({ page }) => {
    const wood = page.locator('details[data-family="wood"]');
    await expect(wood).not.toHaveAttribute("open");
    await wood.locator("summary").click();
    await expect(wood).toHaveAttribute("open");
    await page.reload();
    await expect(page.locator('details[data-family="wood"]')).toHaveAttribute("open");
  });

  test('a família da minha parte já abre aberta, com o "você" à vista', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem("stabat.myPart", JSON.stringify({ id: "tuba-mib-1", name: "Tuba Mib 1" })),
    );
    await page.reload();
    await expect(page.locator('details[data-family="brass-lo"]')).toHaveAttribute("open");
    await expect(page.locator('details[data-family="wood"]')).not.toHaveAttribute("open");
    await expect(page.locator('[data-part="tuba-mib-1"]').getByText("você")).toBeVisible();
  });

  test("a pauta da minha parte fica realçada na grade", async ({ page }) => {
    await expect(page.locator("rect.mine-hl")).toHaveCount(0);
    await page.evaluate(() =>
      localStorage.setItem("stabat.myPart", JSON.stringify({ id: "tuba-mib-1", name: "Tuba Mib 1" })),
    );
    await page.reload();
    const band = page.locator("rect.mine-hl").first();
    await expect(band).toBeAttached();
    // a faixa cobre a 2ª pauta (tuba), não a 1ª (clarinete)
    const [b, tuba, clar] = await page.evaluate(() => {
      const r = (e: Element) => e.getBoundingClientRect();
      const m = document.querySelector("g.measure")!;
      const [s0, s1] = m.querySelectorAll(":scope > g.staff");
      const bb = r(document.querySelector("rect.mine-hl")!);
      const c = (e: Element) =>
        (r(e.querySelector("path")!).top + r([...e.querySelectorAll(":scope > path")].at(-1)!).bottom) / 2;
      return [{ top: bb.top, bottom: bb.bottom }, c(s1!), c(s0!)];
    });
    expect(tuba).toBeGreaterThan(b.top);
    expect(tuba).toBeLessThan(b.bottom);
    expect(clar < b.top || clar > b.bottom).toBe(true);
  });

  test("zoom fica salvo e volta aplicado", async ({ page }) => {
    const base = await scoreScale(page);
    await page.locator("#zin").click();
    await page.locator("#zin").click();
    await expect.poll(() => scoreScale(page)).toBe(Math.round(base * 1.2));
    await page.reload();
    await expect(page.getByTestId("score").locator("g.measure").first()).toBeVisible();
    await expect.poll(() => scoreScale(page)).toBe(Math.round(base * 1.2));
  });

  test("velocidade 75% sem erros (SoundTouch)", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
    await page.locator("#rate").selectOption("0.75");
    await page.locator("#play").click();
    await page.waitForTimeout(2000);
    const s = await engine(page);
    expect(s.rate).toBe(0.75);
    expect(s.pos).toBeGreaterThan(1100);
    expect(s.pos).toBeLessThan(1800);
    await expectSound(page, true);
    expect(warnings.filter((w) => w.includes("SoundTouch"))).toEqual([]);
  });

  test("barra de controles fica colada no rodapé", async ({ page }) => {
    const bar = (await page.getByTestId("bottom-bar").boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(bar.y + bar.height).toBeGreaterThanOrEqual(vh);
    expect(bar.y).toBeGreaterThan(vh / 2);
  });

  test("atalho 'Estudar minha parte' aparece quando há parte salva", async ({ page }) => {
    await expect(page.getByTestId("study-mine")).toHaveCount(0);
    await page.evaluate(() =>
      localStorage.setItem("stabat.myPart", JSON.stringify({ id: "tuba-mib-1", name: "Tuba Mib 1" })),
    );
    await page.reload();
    await expect(page.getByTestId("study-mine")).toHaveText(/Estudar Tuba 1/);
  });
});
