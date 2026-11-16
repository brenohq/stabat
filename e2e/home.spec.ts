import { expect, test } from "@playwright/test";

test.describe("página inicial", () => {
  test("lista os arranjos e filtra pela busca (sem acento)", async ({ page }) => {
    await page.goto("/");
    const cards = page.getByTestId("arrangement-card");
    await expect(cards).toHaveCount(2);
    await page.getByLabel("Buscar arranjo").fill("marcha");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Marcha Grave");
    await page.getByLabel("Buscar arranjo").fill("TÉSTE");
    await expect(cards).toHaveCount(1);
    await page.getByLabel("Buscar arranjo").fill("zzz");
    await expect(page.getByText("Nenhum arranjo encontrado.")).toBeVisible();
  });

  test("busca ocupa a largura toda", async ({ page }) => {
    await page.goto("/");
    const input = await page.getByLabel("Buscar arranjo").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(input!.width).toBeGreaterThan(main!.width - 40);
  });

  test("'Qual é a sua parte?' pulsa até escolher, e a escolha fica salva", async ({ page }) => {
    await page.goto("/");
    const picker = page.locator("#mypart");
    const card = page.locator(".animate-attention");
    await expect(card).toHaveCount(1);
    await picker.selectOption("tuba-mib-1");
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("stabat.myPart"))).toContain("tuba-mib-1");
    // atalho direto para a parte nos dois arranjos que têm tuba
    await expect(page.getByRole("link", { name: "Estudar Tuba 1" })).toHaveCount(2);
    await page.reload();
    await expect(picker).toHaveValue("tuba-mib-1");
  });

  test("cartão inteiro é clicável e leva ao arranjo", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("arrangement-card").first();
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 40); // clica na capa
    await expect(page).toHaveURL(/\/teste$/);
    await expect(page.getByRole("heading", { name: "Arranjo de Teste" })).toBeVisible();
  });

  test("endereço inexistente mostra página de erro", async ({ page }) => {
    await page.goto("/nao-existe");
    await expect(page.getByText("Arranjo não encontrado.")).toBeVisible();
  });
});
