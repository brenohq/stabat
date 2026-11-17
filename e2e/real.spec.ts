import { expect, test } from "@playwright/test";
import { engine, expectSound, openLoaded } from "./helpers";
import index from "../public/arranjos/index.json" with { type: "json" };

/** fumaça com os arranjos publicados: cada um carrega, toca e pausa */
for (const a of index) {
  test(`arranjo publicado: ${a.id}`, async ({ page }) => {
    await openLoaded(page, `/${a.id}`);
    await page.locator("#play").click();
    await expectSound(page, true);
    await page.locator("#play").click();
    expect((await engine(page)).playing).toBe(false);
  });
}

test("parte publicada abre e toca", async ({ page }) => {
  const a = index[0]!;
  await openLoaded(page, `/${a.id}/trompete-sib-1`);
  await page.locator("#play").click();
  await expectSound(page, true);
  await expect(page.getByTestId("level-me")).toHaveText("90%");
});
