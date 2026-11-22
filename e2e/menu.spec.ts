import { expect, test } from "@playwright/test";

test.describe("menu do topo", () => {
  test("abre, mostra o calendário e o grupo Jogos fechado; Esc fecha", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(menu.getByRole("link", { name: "Calendário da Banda" })).toBeVisible();
    // ordem: Calendário > Estudos > Jogos
    await expect(menu.locator(":scope > a, :scope > button")).toHaveText([
      "Calendário da Banda",
      "Estudos",
      "Jogos",
    ]);
    const games = menu.getByRole("button", { name: "Jogos" });
    await expect(games).toHaveAttribute("aria-expanded", "false");
    await expect(menu.getByRole("link", { name: "Que nota é essa?" })).toHaveCount(0);
    await games.click();
    await expect(menu.locator("#menu-games a")).toHaveText(["Que nota é essa?", "Bate o ritmo"]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("leva ao jogo, fecha sozinho e abre com Jogos aberto na página do jogo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Jogos" }).click();
    await page.getByRole("link", { name: "Que nota é essa?" }).click();
    await expect(page).toHaveURL(/\/jogos\/que-nota$/);
    await expect(page.getByRole("heading", { name: "Que nota é essa?" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menu" })).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("button", { name: "Jogos" })).toHaveAttribute("aria-expanded", "true");
  });

  test("clique fora fecha", async ({ page }) => {
    await page.goto("/calendario");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("heading", { name: "Calendário da Banda" }).click();
    await expect(page.getByRole("navigation", { name: "Menu" })).toBeHidden();
  });

  test("/jogos leva ao jogo", async ({ page }) => {
    await page.goto("/jogos");
    await expect(page).toHaveURL(/\/jogos\/que-nota$/);
  });
});
