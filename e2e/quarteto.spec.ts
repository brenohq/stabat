import { expect, test } from "@playwright/test";
import { openLoaded, pickPart } from "./helpers";

/** /quarteto: página escondida com o repertório do quarteto (fixture: e2e/fixtures/arranjos/quarteto) */
test.describe("quarteto", () => {
  test("lista só os arranjos do quarteto, e a home da banda não mostra nem leva até lá", async ({ page }) => {
    await page.goto("/quarteto");
    await expect(page.getByRole("heading", { name: "Repertório do quarteto" })).toBeVisible();
    const cards = page.getByTestId("arrangement-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Natal do Quarteto");

    await page.goto("/");
    await expect(page.getByTestId("arrangement-card")).toHaveCount(2);
    await expect(page.getByText("Natal do Quarteto")).toHaveCount(0);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator('a[href^="/quarteto"]')).toHaveCount(0);
  });

  test("arranjo e parte ficam dentro de /quarteto e carregam os dados do quarteto", async ({ page }) => {
    const data: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/__fixtures__/")) data.push(new URL(r.url()).pathname);
    });
    await page.goto("/quarteto");
    // o título (que vai para o Analytics) diz que é do quarteto
    await expect(page).toHaveTitle("stabat · Repertório do quarteto");
    await page.getByTestId("arrangement-card").first().click();
    await expect(page).toHaveURL(/\/quarteto\/natal$/);
    await expect(page).toHaveTitle("stabat · Quarteto · Natal do Quarteto");
    await openLoaded(page, "/quarteto/natal");
    const natal = data.filter((p) => p.includes("/natal/"));
    expect(natal.length).toBeGreaterThan(0);
    expect(natal.every((p) => p.includes("/arranjos/quarteto/natal/"))).toBe(true);

    // o logo leva ao site principal; as migalhas voltam para o quarteto
    await expect(page.getByRole("link", { name: "stabat" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("navigation", { name: "Navegação" }).getByRole("link")).toHaveAttribute(
      "href",
      "/quarteto",
    );

    await openLoaded(page, "/quarteto/natal/tuba-mib-1");
    await expect(page.getByRole("button", { name: "Só quarteto" })).toBeVisible();
    await expect(page).toHaveTitle("stabat · Quarteto · Tuba Mib 1 · Natal do Quarteto");
    await expect(page.getByRole("link", { name: "Voltar ao arranjo" })).toHaveAttribute(
      "href",
      "/quarteto/natal",
    );
  });

  test("a parte do quarteto é lembrada à parte da parte da banda", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem(
        "stabat.myPart",
        JSON.stringify({ id: "clarinete-sib-1", name: "Clarinete Sib 1" }),
      ),
    );
    await page.goto("/quarteto");
    await expect(page.locator(".animate-attention")).toHaveCount(1);
    await pickPart(page, "#mypart", "tuba-mib-1");
    expect(await page.evaluate(() => localStorage.getItem("stabat.quarteto.myPart"))).toContain("tuba-mib-1");
    expect(await page.evaluate(() => localStorage.getItem("stabat.myPart"))).toContain("clarinete-sib-1");
    await expect(page.getByRole("link", { name: /Estudar/ })).toHaveAttribute(
      "href",
      "/quarteto/natal/tuba-mib-1",
    );
  });

  test("sem arranjos publicados, mostra 'Em breve'", async ({ page }) => {
    await page.route("**/arranjos/quarteto/index.json*", (r) => r.fulfill({ json: [] }));
    await page.goto("/quarteto");
    await expect(page.getByTestId("empty-repertoire")).toBeVisible();
    await expect(page.locator("#mypart")).toHaveCount(0);
    await expect(page.getByLabel("Buscar arranjo")).toHaveCount(0);
  });

  test("arranjo inexistente volta para o quarteto", async ({ page }) => {
    await page.goto("/quarteto/nao-existe");
    await expect(page.getByText("Arranjo não encontrado.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver o repertório" })).toHaveAttribute("href", "/quarteto");
  });
});
