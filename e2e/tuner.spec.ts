import { expect, test, type Page } from "@playwright/test";

/** o microfone falso (projeto "tuner") toca sem parar um Lá de 442 Hz: +8 cents com Lá = 440 */
const open = async (page: Page, prefs: Record<string, unknown>) => {
  await page.addInitScript((p) => {
    for (const [k, v] of Object.entries(p)) localStorage.setItem(`stabat.${k}`, JSON.stringify(v));
  }, prefs);
  await page.goto("/afinador");
  await expect(page.getByTestId("tuner")).toBeVisible();
};
const state = (page: Page) => page.evaluate(() => (window as any).__stabat.tuner.state());

test.describe("afinador", () => {
  test("trompete: toca Si; o Lá de 442 Hz dá +8 cents, afinado", async ({ page }) => {
    await open(page, { "tuner.instrument": "trompete" });
    await expect(page.getByTestId("tuner-note")).toHaveText("Si");
    await expect(page.getByText("B · soa Lá de concerto")).toBeVisible();
    await expect(page.getByTestId("tuner-advice")).toHaveText("Ligue o microfone para começar.");
    await page.getByRole("button", { name: "Ligar o microfone" }).click();
    await expect(page.getByTestId("tuner-cents")).toHaveText(/^\+(7|8|9) cents$/);
    await expect(page.getByTestId("tuner-advice")).toHaveText("Afinado!");
    const s = await state(page);
    expect(s.cents).toBeGreaterThan(6.5);
    expect(s.cents).toBeLessThan(9.5);
    await expect(page.getByText("442,0 Hz")).toBeVisible();
    await page.getByRole("button", { name: "Desligar o microfone" }).click();
    await expect(page.getByTestId("tuner-cents")).toHaveText("—");
  });

  test("sax alto lê Fá♯; com Lá = 436 o mesmo som fica um pouco alto (+24) e manda puxar a boquilha", async ({
    page,
  }) => {
    await open(page, { "tuner.instrument": "sax-alto", "tuner.a4": 437 });
    await expect(page.getByTestId("tuner-note")).toHaveText("Fá♯");
    await page.getByRole("button", { name: "Baixar o Lá" }).click();
    await expect(page.getByTestId("tuner-a4")).toHaveText("Lá = 436 Hz");
    await expect(page.getByRole("button", { name: "Baixar o Lá" })).toBeDisabled();
    await page.getByRole("button", { name: "Ligar o microfone" }).click();
    await expect(page.getByTestId("tuner-cents")).toHaveText(/^\+2[3-5] cents$/);
    await expect(page.getByTestId("tuner-advice")).toHaveText(
      "Um pouco alto: puxe a boquilha um pouco para fora",
    );
    // lembra o Lá escolhido
    expect(await page.evaluate(() => localStorage.getItem("stabat.tuner.a4"))).toBe("436");
  });

  test("rodada: o maestro escolhe o instrumento; 1,5 s no verde marca afinado; Recomeçar limpa", async ({
    page,
  }) => {
    await open(page, {});
    await page.getByRole("button", { name: "Rodada da banda" }).click();
    const items = page.getByTestId("round-item");
    await expect(items).toHaveCount(10);
    await expect(items.first()).toHaveText("Clarinete Sib");
    await expect(items.last()).toHaveText("Flauta doce");
    await items.filter({ hasText: "Sax Alto Mib" }).click();
    await expect(page.getByTestId("tuner-note")).toHaveText("Fá♯");
    await page.getByRole("button", { name: "Ligar o microfone" }).click();
    await expect(page.getByTestId("round-count")).toHaveText("1 de 10 afinados", { timeout: 6000 });
    await expect(
      items.filter({ hasText: "Sax Alto Mib" }).getByLabel(/afinado \(\+\d cents\)/),
    ).toBeVisible();
    // não passa sozinho para o próximo
    await expect(items.filter({ hasText: "Sax Alto Mib" })).toHaveAttribute("aria-pressed", "true");
    await items.filter({ hasText: "Trombone Sib" }).click();
    await expect(page.getByTestId("tuner-note")).toHaveText("Si");
    await expect(page.getByTestId("round-count")).toHaveText("2 de 10 afinados", { timeout: 6000 });
    await page.getByRole("button", { name: "Recomeçar" }).click();
    await expect(page.getByTestId("round-count")).toHaveText(/^[01] de 10 afinados$/);
    // o modo fica lembrado; a rodada não é guardada
    await page.reload();
    await expect(page.getByRole("button", { name: "Rodada da banda" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("round-count")).toHaveText("0 de 10 afinados");
  });

  test("mostrador: ponteiro, barra ou estrobo, lembrado", async ({ page }) => {
    await open(page, {});
    await expect(page.getByRole("button", { name: "Ponteiro" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Estrobo" }).click();
    await expect(page.getByText("Paradas = afinado")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Estrobo" })).toHaveAttribute("aria-pressed", "true");
    // a referência liga e desliga
    const ref = page.getByRole("button", { name: "♪ Lá de referência" });
    await ref.click();
    await expect(ref).toHaveAttribute("aria-pressed", "true");
    await ref.click();
    await expect(ref).toHaveAttribute("aria-pressed", "false");
  });

  test("pelo menu, logo depois do Calendário", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Afinador" }).click();
    await expect(page).toHaveURL(/\/afinador$/);
    await expect(page.getByRole("heading", { name: "Afinador", level: 1 })).toBeVisible();
  });
});
