import { expect, test } from "@playwright/test";

test.describe("calendário", () => {
  test("link no topo leva à agenda, em ordem, com dia e hora", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-17T10:00:00-03:00"));
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Calendário da Banda" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
    await expect(page.getByRole("heading", { name: "Calendário da Banda" })).toBeVisible();
    const eventos = page.getByTestId("evento");
    await expect(eventos).toHaveCount(2);
    await expect(eventos.nth(0)).toContainText("Ensaio na Praça");
    await expect(eventos.nth(0)).toContainText("Sexta-feira · 19h");
    await expect(eventos.nth(0)).toContainText("faltam 3 dias");
    await expect(eventos.nth(1)).toContainText("Concerto Natalino");
    await expect(eventos.nth(1)).toContainText("Terça-feira · 19h");
    await expect(page.getByText("Já aconteceram")).toHaveCount(0);
  });

  test("compromissos que já passaram vão para o fim", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-25T10:00:00-03:00"));
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { name: "Já aconteceram" })).toBeVisible();
    await expect(page.getByTestId("evento").first()).toContainText("Concerto Natalino");
    await expect(page.getByTestId("evento").last()).toContainText("Ensaio na Praça");
  });

  test("o menu aparece também na página do arranjo", async ({ page }) => {
    await page.goto("/teste");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("link", { name: "Calendário da Banda" })).toBeVisible();
  });
});
