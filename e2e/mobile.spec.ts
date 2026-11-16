import { expect, test } from "@playwright/test";
import { openLoaded } from "./helpers";

test.describe("celular", () => {
  test("parte: sem abreviação do instrumento e barra no rodapé", async ({ page }) => {
    await openLoaded(page, "/teste/clarinete-sib-1");
    await expect(page.getByTestId("score")).not.toContainText("Cl. 1");
    const bar = (await page.getByTestId("bottom-bar").boundingBox())!;
    expect(bar.y + bar.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  });

  test("arranjo: gaveta de instrumentos abre acima da barra", async ({ page }) => {
    await openLoaded(page, "/teste");
    const panel = page.getByTestId("mixer-panel");
    await expect(panel).toBeHidden();
    await page.getByRole("button", { name: "Instrumentos", exact: true }).click();
    await expect(panel).toBeVisible();
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
});
