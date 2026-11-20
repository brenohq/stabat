import { expect, test } from "@playwright/test";
import { engine, openPlayer, pickPart } from "./helpers";

test.describe("página /smells (escondida)", () => {
  test("a fixture não tem notas fora da extensão (Dó4 ainda vale)", async ({ page }) => {
    await openPlayer(page, "/teste/tuba-mib-1/smells");
    await expect(page.getByTestId("smells-count")).toHaveText(/Nenhuma nota fora/);
    await expect(page.getByTestId("score").locator("g.note.smell")).toHaveCount(0);
  });

  test("realça em vermelho notas fora da extensão do clarinete (Dó4 a Si5)", async ({ page }) => {
    // 1ª nota do c. 2 vira Dó6 e a 1ª do c. 5 vira Lá3 (alturas escritas; o clarinete vai até Si5)
    await page.route(
      (u) => u.pathname.endsWith("/parts/clarinete-sib-1.musicxml"),
      async (route) => {
        const res = await route.fetch();
        let xml = await res.text();
        const first = /(<measure number="N">(?:(?!<note>).)*<note><pitch><step>)E(<\/step><octave>)5/s;
        xml = xml.replace(new RegExp(first.source.replace("N", "2"), "s"), "$1C$26");
        xml = xml.replace(new RegExp(first.source.replace("N", "5"), "s"), "$1A$23");
        await route.fulfill({ response: res, body: xml });
      },
    );
    await page.evaluate(() => localStorage.removeItem("stabat.myPart")).catch(() => {});
    await openPlayer(page, "/teste/clarinete-sib-1/smells");

    const box = page.getByTestId("smells");
    await expect(page.getByTestId("smells-count")).toHaveText(/2 notas \(1 aguda, 1 grave\) em 2 compassos/);
    const score = page.getByTestId("score");
    await expect(score.locator("g.note.smell")).toHaveCount(2);
    await expect(score.locator("rect.smell-hl")).toHaveCount(2);
    await expect(score.locator("g.measure").nth(1).locator("g.note.smell")).toHaveCount(1);
    await expect(score.locator("g.measure").nth(4).locator("g.note.smell")).toHaveCount(1);

    // coluna à direita (desktop): contador da parte e de cada parte do arranjo
    const panel = page.getByTestId("smell-panel");
    await expect(box).toBeHidden();
    await expect(panel.getByTestId("smell-panel-count")).toHaveText("2");
    await expect(panel.getByTestId("smell-panel-range")).toHaveText("Extensão: Dó4 a Si5 (escrito)");
    await expect(panel.getByTestId("smell-panel-total")).toHaveText("2 em 1 parte");
    await expect(panel.getByRole("link", { name: /Tuba/ })).toContainText("✓");

    // clicar no compasso leva até ele
    await panel.getByRole("button", { name: "c. 5" }).click();
    await expect.poll(async () => (await engine(page)).measure).toBe(4);

    // revisar smells não troca a "minha parte"; o seletor continua em /smells
    expect(await page.evaluate(() => localStorage.getItem("stabat.myPart"))).toBeNull();
    await pickPart(page, "#switch", "tuba-mib-1");
    await expect(page).toHaveURL(/\/teste\/tuba-mib-1\/smells$/);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("a página normal da parte não mostra smells", async ({ page }) => {
    await openPlayer(page, "/teste/clarinete-sib-1");
    await expect(page.getByTestId("smells")).toHaveCount(0);
    await expect(page.getByTestId("score").locator("g.note.smell")).toHaveCount(0);
  });
});
