import { expect, test } from "@playwright/test";
import { engine, expectSound, openLoaded } from "./helpers";
import index from "../public/arranjos/index.json" with { type: "json" };
import quartet from "../public/arranjos/quarteto/index.json" with { type: "json" };

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

/** quarteto (/quarteto): enquanto não houver arranjos publicados, o índice é [] e nada roda aqui */
for (const a of quartet as { id: string }[]) {
  test(`arranjo publicado do quarteto: ${a.id}`, async ({ page }) => {
    await openLoaded(page, `/quarteto/${a.id}`);
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

/** cada parte publicada tem o PDF do MuseScore (botão "Imprimir partes") */
test("partes publicadas têm PDF", async ({ request }) => {
  const all = [...index.map((a) => a.id), ...(quartet as { id: string }[]).map((a) => `quarteto/${a.id}`)];
  for (const id of all) {
    const meta = await (await request.get(`/arranjos/${id}/meta.json`)).json();
    for (const p of meta.parts as { id: string }[]) {
      const r = await request.get(`/arranjos/${id}/pdf/${p.id}.pdf`);
      expect(r.ok(), `${id}/pdf/${p.id}.pdf`).toBe(true);
      expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
    }
  }
});
