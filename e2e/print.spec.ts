import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { openPlayer } from "./helpers";

/** no arranjo de teste: Clarinete Sib 1 tem 2 páginas, Tuba Mib 1 tem 1 */
const copies = (page: Page, name: string) => page.getByLabel(`Cópias de ${name}`);

async function downloadPages(page: Page): Promise<number> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Arranjo de Teste - partes.pdf");
  const doc = await PDFDocument.load(readFileSync((await download.path())!));
  return doc.getPageCount();
}

test.describe("imprimir partes", () => {
  test.beforeEach(async ({ page }) => {
    await openPlayer(page, "/teste");
    await page.getByTestId("print-open").click();
  });

  test("abre com todas as partes marcadas e 1 cópia de cada", async ({ page }) => {
    const dialog = page.getByTestId("print-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "Clarinete Sib 1" })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Tuba Mib 1" })).toBeChecked();
    await expect(copies(page, "Clarinete Sib 1")).toHaveValue("1");
    await expect(page.getByTestId("print-total")).toHaveText("2 cópias · 2 partes");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("PDF junta as cópias de cada parte e lembra as cópias", async ({ page }) => {
    await copies(page, "Clarinete Sib 1").fill("3");
    await page.getByRole("button", { name: "Mais uma cópia de Tuba Mib 1" }).click();
    await expect(page.getByTestId("print-total")).toHaveText("5 cópias · 2 partes");
    expect(await downloadPages(page)).toBe(3 * 2 + 2 * 1);
    await expect(page.getByTestId("print-dialog")).toBeHidden();

    await page.reload();
    await page.getByTestId("print-open").click();
    await expect(copies(page, "Clarinete Sib 1")).toHaveValue("3");
    await expect(copies(page, "Tuba Mib 1")).toHaveValue("2");
  });

  test("desmarcar tira a parte; sem partes não imprime", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Clarinete Sib 1" }).uncheck();
    await expect(copies(page, "Clarinete Sib 1")).toBeDisabled();
    await expect(page.getByTestId("print-total")).toHaveText("1 cópia · 1 parte");
    expect(await downloadPages(page)).toBe(1);

    await page.getByTestId("print-open").click();
    await page.getByRole("button", { name: "nenhuma" }).click();
    await expect(page.getByTestId("print-total")).toHaveText("Nenhuma parte marcada");
    await expect(page.getByRole("button", { name: "Imprimir", exact: true })).toBeDisabled();
  });

  test("Imprimir manda o PDF para o diálogo de impressão", async ({ page }) => {
    await page.getByRole("button", { name: "Imprimir", exact: true }).click();
    await expect(page.getByTestId("print-frame")).toHaveAttribute("src", /^blob:/);
    await expect(page.getByTestId("print-dialog")).toBeHidden();
  });
});
