import { expect, test } from "@playwright/test";

test.describe("menu do topo", () => {
  test("abre, mostra o calendário e o grupo Jogos fechado; Esc fecha", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Menu" });
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(menu.getByRole("link", { name: "Calendário da Banda" })).toBeVisible();
    // ordem: Calendário > Afinador > Estudos > Jogos
    await expect(menu.locator(":scope > a, :scope > button")).toHaveText([
      "Calendário da Banda",
      "Afinador",
      "Estudos",
      "Jogos",
    ]);
    const games = menu.getByRole("button", { name: "Jogos" });
    await expect(games).toHaveAttribute("aria-expanded", "false");
    await expect(menu.getByRole("link", { name: "Que nota é essa?" })).toHaveCount(0);
    await games.click();
    await expect(menu.locator("#menu-games a")).toHaveText([
      "Todos os jogos",
      "Que nota é essa?",
      "Bate o ritmo",
    ]);
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

  test("/jogos: vitrine com os dois jogos; o progresso aparece depois de jogar", async ({ page }) => {
    await page.goto("/jogos");
    await expect(page.getByRole("heading", { name: "Jogos", level: 1 })).toBeVisible();
    const cards = page.getByTestId("game-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.getByRole("heading")).toHaveText(["Que nota é essa?", "Bate o ritmo"]);
    await expect(cards.getByTestId("game-progress")).toHaveText(["Novo", "Novo"]);
    // cartão clicável por inteiro
    await cards.nth(1).click({ position: { x: 40, y: 60 } }); // na capa, fora do título
    await expect(page).toHaveURL(/\/jogos\/ritmo$/);
    // a migalha "Jogos" volta para a vitrine
    await page.getByRole("navigation", { name: "Navegação" }).getByRole("link", { name: "Jogos" }).click();
    await expect(page).toHaveURL(/\/jogos$/);
    await page.evaluate(() =>
      localStorage.setItem("stabat.games.rhythm", JSON.stringify({ v: 1, introduced: 5, tick: 12 })),
    );
    await page.reload();
    await expect(page.getByTestId("game-progress").nth(1)).toHaveText("Nível 2 · 5 de 13 ritmos");
  });
});
