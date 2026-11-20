import { expect, test } from "@playwright/test";
import { openPlayer } from "./helpers";

test.describe("celular", () => {
  test("parte: sem abreviação do instrumento e barra no rodapé", async ({ page }) => {
    await openPlayer(page, "/teste/clarinete-sib-1");
    await expect(page.getByTestId("score")).not.toContainText("Cl. 1");
    const bar = (await page.getByTestId("bottom-bar").boundingBox())!;
    expect(bar.y + bar.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  });

  test("parte: a rolagem automática rola só a área da partitura e a barra fica no rodapé", async ({
    page,
  }) => {
    // tela baixa e partitura grande: o arranjo de teste (6 compassos) não cabe
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
    await openPlayer(page, "/teste/clarinete-sib-1");
    for (let i = 0; i < 8; i++) await page.locator("#zin").click();
    const area = page.getByTestId("scroll-area");
    await expect.poll(() => area.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(150);
    await page.evaluate(() => {
      const p = (window as unknown as { __stabat: { page: { view: { scrollTo(i: number): void } } } })
        .__stabat.page;
      p.view.scrollTo(5);
    });
    await expect.poll(() => area.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // o documento não rola (no celular isso mexeria na barra de endereço e descolaria a barra)
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
    const bar = (await page.getByTestId("bottom-bar").boundingBox())!;
    expect(Math.round(bar.y + bar.height)).toBe(page.viewportSize()!.height);
  });

  test("arranjo: gaveta de instrumentos abre acima da barra", async ({ page }) => {
    await openPlayer(page, "/teste");
    const panel = page.getByTestId("mixer-panel");
    await expect(panel).toBeHidden();
    await page.getByRole("button", { name: "Instrumentos", exact: true }).click();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("print-open")).toBeHidden(); // imprimir é só no computador
    const p = (await panel.boundingBox())!;
    const bar = (await page.getByTestId("bottom-bar").boundingBox())!;
    expect(p.y + p.height).toBeLessThanOrEqual(bar.y + 2);
  });

  test("home: sem rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("arrangement-card").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });

  test("calendário: menu no topo leva à agenda e a página não rola para o lado", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Calendário da Banda" }).click();
    await expect(page.getByTestId("evento").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });
});
