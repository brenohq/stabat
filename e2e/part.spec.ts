import { expect, test } from "@playwright/test";
import { clickMeasure, engine, expectSound, openPlayer, pickPart, play, scoreScale } from "./helpers";
import { SCORE_SCALE } from "../src/score/sizing";

test.describe("página da parte", () => {
  test.beforeEach(async ({ page }) => openPlayer(page, "/teste/clarinete-sib-1"));

  test("abre com 90% minha parte / 10% banda e grava a parte escolhida", async ({ page }) => {
    await expect(page.getByTestId("level-me")).toHaveText("90%");
    await expect(page.getByTestId("level-band")).toHaveText("10%");
    await play(page); // o volume da parte é igualado ao da banda quando o áudio chega
    // banda 6 dB abaixo (0,5) × 10/90; a parte vai ao mesmo volume percebido da banda
    await expect.poll(async () => (await engine(page)).gains[1]).toBeCloseTo(0.056, 2);
    const [me, band] = (await engine(page)).gains;
    expect(me).toBeGreaterThan(band!);
    expect(await page.evaluate(() => localStorage.getItem("stabat.myPart"))).toContain("clarinete-sib-1");
  });

  test("atalhos de volume", async ({ page }) => {
    await play(page);
    await page.getByRole("button", { name: "Só banda" }).click();
    await expect(page.getByTestId("level-me")).toHaveText("0%");
    await expect.poll(async () => (await engine(page)).gains[0]).toBe(0);
    expect((await engine(page)).gains[1]).toBeCloseTo(0.5, 2);
    await page.getByRole("button", { name: "Só minha parte" }).click();
    await expect.poll(async () => (await engine(page)).gains[1]).toBe(0);
    expect((await engine(page)).gains[0]).toBeGreaterThan(0);
  });

  test("play/pause com som", async ({ page }) => {
    await play(page);
    await expectSound(page, true);
    await page.locator("#play").click();
    await expectSound(page, false);
    expect((await engine(page)).playing).toBe(false);
  });

  test("repetir trecho volta ao início do trecho", async ({ page }) => {
    await page.locator("#loop").click();
    await expect(page.getByText("Clique no primeiro compasso do trecho")).toBeVisible();
    await clickMeasure(page, 2);
    await clickMeasure(page, 3);
    await expect(page.locator("#loop")).toContainText("c. 3–4");
    await expect.poll(async () => (await engine(page)).loop).toEqual([4000, 8000]);
    await expect.poll(async () => (await engine(page)).playing).toBe(true);
    await page.evaluate(() => (window as any).__stabat.page.engine.seek(7600));
    await page.waitForTimeout(900);
    const s = await engine(page);
    expect(s.playing).toBe(true);
    expect(s.pos).toBeGreaterThanOrEqual(4000);
    expect(s.pos).toBeLessThan(5000);
    await page.locator("#loop").click(); // desliga
    await expect.poll(async () => (await engine(page)).loop).toBeNull();
  });

  test("zoom fica salvo", async ({ page }) => {
    await page.locator("#zin").click();
    await page.locator("#zin").click();
    expect(await page.evaluate(() => localStorage.getItem("stabat.zoom"))).toBe("1.2");
    await page.locator("#zout").click();
    expect(await page.evaluate(() => localStorage.getItem("stabat.zoom"))).toBe("1.1");
    const zoomed = await scoreScale(page);
    await page.reload();
    await expect(page.getByTestId("score").locator("g.measure").first()).toBeVisible();
    await expect.poll(() => scoreScale(page)).toBe(zoomed);
  });

  test("o zoom da parte vale também no arranjo", async ({ page }) => {
    await page.locator("#zin").click();
    await page.locator("#zin").click();
    await openPlayer(page, "/teste");
    await expect.poll(() => scoreScale(page)).toBe(Math.round(SCORE_SCALE.desktop * 1.2));
  });

  test("trocar a parte navega e grava", async ({ page }) => {
    await pickPart(page, "#switch", "tuba-mib-1");
    await expect(page).toHaveURL(/\/teste\/tuba-mib-1$/);
    await expect(page.getByRole("heading", { name: "Tuba Mib 1" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("stabat.myPart"))).toContain("tuba-mib-1");
  });

  test("contagem e metrônomo", async ({ page }) => {
    await expect(page.locator("#metro")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#count").click();
    expect((await engine(page)).countIn).toBe(true);
    await play(page);
    await page.waitForTimeout(1200); // 4 tempos de contagem = 2 s: ainda não andou
    expect((await engine(page)).pos).toBe(0);
    await expect.poll(async () => (await engine(page)).pos, { timeout: 5000 }).toBeGreaterThan(200);
  });

  test("parte inexistente", async ({ page }) => {
    await page.goto("/teste/flauta-9");
    await expect(page.getByText("Esta parte não existe neste arranjo.")).toBeVisible();
  });
});
