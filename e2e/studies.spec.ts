import { expect, test, type Page } from "@playwright/test";

interface StudyState {
  lesson: string;
  scale: string;
  instrument: string;
  index: number;
  note: string;
  playing: boolean;
  /** MIDI da nota de piano soando (altura escrita) ou null */
  sounding: number | null;
  perRow?: number;
  count?: number;
}

const state = (page: Page): Promise<StudyState> =>
  page.evaluate(() => (window as any).__stabat.study.state());

/** escolhe o instrumento no seletor (o mesmo seletor de parte do repertório) */
async function choose(page: Page, id: string) {
  await page.locator("#study-instrument").click();
  await page.locator(`[role=option][data-part="${id}"]`).click();
  await expect(page.locator("#study-instrument")).toHaveAttribute("data-value", id);
}

/** a primeira linha de pauta (cada linha repete a armadura, como na partitura) */
const firstStaff = (page: Page) => page.getByTestId("study-sheet").locator("svg").first();

const next = (page: Page) => page.getByRole("button", { name: "Próxima nota" }).click();

test.describe("estudos", () => {
  test("menu leva ao catálogo; o instrumento escolhido vale na lição", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Estudos" }).click();
    await expect(page).toHaveURL(/\/estudos$/);
    await expect(page.getByTestId("lesson-card")).toHaveCount(3);
    // sem parte salva: começa pela flauta doce, o instrumento dos novatos
    await expect(page.locator("#study-instrument")).toHaveAttribute("data-value", "flauta-doce");
    await choose(page, "sax-alto");
    await page.getByRole("link", { name: "Escalas Menores" }).click();
    await expect(page).toHaveURL(/\/estudos\/escalas-menores$/);
    await expect(page.locator("#study-instrument")).toHaveAttribute("data-value", "sax-alto");
    await expect(page.getByTestId("fingering")).toHaveAttribute("data-mechanism", "sax");
  });

  test("a parte da banda define o instrumento; armadura e digitação de cada nota", async ({ page }, info) => {
    await page.addInitScript(() =>
      localStorage.setItem("stabat.myPart", JSON.stringify({ id: "trompete-sib-1", name: "Trompete Sib 1" })),
    );
    await page.goto("/estudos/escalas-maiores?escala=fa-maior");
    await expect(page.locator("#study-instrument")).toHaveAttribute("data-value", "trompete");
    await expect(page.getByRole("radio", { name: "Fá maior" })).toHaveAttribute("aria-checked", "true");
    await expect(firstStaff(page).getByTestId("key-signature")).toHaveCount(1);
    // Fá4 = 1º pistão
    const fing = page.getByTestId("fingering");
    await expect(fing.locator('[data-key="1"]')).toHaveAttribute("data-on", "1");
    await expect(page.getByTestId("study-fingering")).toHaveText("Pistão 1");
    await next(page);
    await expect(page.getByTestId("study-note")).toContainText("Sol");
    await expect(page.getByTestId("study-fingering")).toHaveText("Nenhum pistão (solta)");
    // o que muda da nota anterior: só no painel lateral (no celular, o painel do topo tem altura fixa)
    if (info.project.name !== "mobile") await expect(page.getByText("solta pistão 1")).toBeVisible();
    // clicar numa nota da pauta: Si♭
    await page.getByRole("button", { name: "Si♭4", exact: true }).click();
    expect((await state(page)).note).toBe("Bb4");
  });

  test("trombone: a mão marca a posição na régua", async ({ page }) => {
    await page.goto("/estudos/escalas-maiores");
    await choose(page, "trombone");
    await next(page); // Ré4
    await expect(page.locator('[data-pos="6"]')).toHaveAttribute("data-on", "1");
    await expect(page.getByTestId("study-fingering")).toHaveText("6ª posição");
  });

  test("flauta doce: meio polegar no Mi agudo", async ({ page }) => {
    await page.goto("/estudos/escalas-menores?escala=la-menor");
    await choose(page, "flauta-doce");
    for (let i = 0; i < 4; i++) await next(page); // Lá menor: Lá Si Dó Ré Mi
    expect((await state(page)).note).toBe("E5");
    await expect(page.getByTestId("fingering").locator('[data-key="T"]')).toHaveAttribute("data-on", "half");
  });

  test("tocar a escala anda nota a nota e para sozinho; metrônomo ligado por padrão", async ({ page }) => {
    await page.goto("/estudos/escalas-maiores");
    const metro = page.getByRole("button", { name: "Metrônomo" });
    await expect(metro).toHaveAttribute("aria-pressed", "true");
    await metro.click(); // sem a contagem, começa direto
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Mais rápido" }).click();
    await expect(page.getByTestId("study-bpm")).toHaveText("120 bpm");
    await page.getByTestId("study-play").click();
    await expect.poll(async () => (await state(page)).index, { timeout: 5000 }).toBeGreaterThan(2);
    expect((await state(page)).playing).toBe(true);
    // sobe e desce: 15 notas a 120 bpm ≈ 7,5 s
    await expect.poll(async () => (await state(page)).playing, { timeout: 15_000 }).toBe(false);
    expect((await state(page)).index).toBe(0);
  });

  test("miniaturas sob a pauta só no computador; no celular, só o nome", async ({ page }, info) => {
    await page.goto("/estudos/escalas-maiores");
    const mini = page.getByTestId("scale-note").first().locator("svg");
    if (info.project.name === "mobile") await expect(mini).toBeHidden();
    else await expect(mini).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });

  test("o som é piano na altura escrita, igual em todo instrumento, e dura enquanto a nota está ativa", async ({
    page,
  }) => {
    const samples: number[] = [];
    page.on("response", (r) => r.url().includes("/audio/piano/") && samples.push(r.status()));
    await page.goto("/estudos/escalas-maiores");
    await expect.poll(() => samples.length).toBe(14);
    expect(samples.every((s) => s === 200)).toBe(true);
    for (const id of ["tuba", "flauta-doce"]) {
      await choose(page, id);
      await page.getByRole("button", { name: "Mi4", exact: true }).click();
      await expect.poll(async () => (await state(page)).sounding).toBe(64); // Mi4 escrito
    }
    // continua soando enquanto ninguém troca de nota
    await page.waitForTimeout(2500);
    expect((await state(page)).sounding).toBe(64);
    await next(page);
    await expect.poll(async () => (await state(page)).sounding).toBe(65);
  });

  test("sete escalas por lição; trocar de escala não mexe a pauta", async ({ page }) => {
    await page.goto("/estudos/escalas-maiores");
    const radios = page.getByRole("radiogroup", { name: "Escala" }).getByRole("radio");
    await expect(radios).toHaveCount(7);
    const staff = page.getByTestId("study-sheet").locator("svg").first();
    const box = async () => {
      const b = (await staff.boundingBox())!;
      return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
    };
    const at = await box();
    for (const name of ["Si maior", "Fá maior", "Ré maior", "Dó maior"]) {
      await page.getByRole("radio", { name }).click();
      expect(await box(), name).toEqual(at);
    }
    await page.getByRole("radio", { name: "Si maior" }).click();
    await expect(firstStaff(page).getByTestId("key-signature")).toHaveCount(5);
  });

  test("tuba: escala que passaria da extensão vai uma oitava abaixo", async ({ page }) => {
    await page.goto("/estudos/escalas-maiores?escala=si-maior");
    await choose(page, "tuba");
    expect((await state(page)).note).toBe("B3");
    await choose(page, "trompete");
    expect((await state(page)).note).toBe("B4");
  });

  test("escala cromática: toda a extensão do instrumento, com a digitação de cada nota", async ({ page }) => {
    await page.goto("/estudos");
    await page.getByRole("link", { name: "Escala Cromática" }).click();
    await expect(page).toHaveURL(/\/estudos\/escala-cromatica$/);
    await choose(page, "sax-alto");
    await expect(page.getByTestId("chromatic-range")).toHaveText("32 notas, de Lá♯/Si♭3 a Fá6");
    await expect(page.getByTestId("scale-note")).toHaveCount(32);
    // uma semibreve por compasso: barra depois de cada altura, barra final no fim
    await expect(page.getByTestId("barline")).toHaveCount(31);
    await expect(page.getByTestId("final-barline")).toHaveCount(1);
    await expect(page.getByTestId("note-accidental").first()).toBeVisible();
    await page.locator('[data-testid=scale-note][data-note="F6"]').click();
    expect((await state(page)).note).toBe("F6");
    await expect(page.getByTestId("study-fingering").first()).toHaveText(
      "oitava · palma Ré · palma Mi♭ · palma Fá",
    );
    await choose(page, "flauta-doce");
    await expect(page.getByTestId("chromatic-range")).toHaveText("27 notas, de Dó4 a Ré6");
    await page.locator('[data-testid=scale-note][data-note="C#6"]').click();
    await expect(page.locator('[data-testid=fingering] [data-key="bell"]').first()).toHaveAttribute(
      "data-on",
      "1",
    );
  });

  test("cromática: alteradas com sustenido e bemol, nas cores do jogo, e lupa", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("stabat.studies.instrument", JSON.stringify("trompete")),
    );
    await page.goto("/estudos/escala-cromatica");
    // Lá♯ / Si♭: as duas grafias na pauta e no nome
    await page.locator('[data-testid=scale-note][data-note="A#4"]').click();
    await expect(page.getByTestId("study-note").first()).toContainText("Lá♯/Si♭");
    await expect(page.locator('[data-testid=scale-note][data-note="A#4"]')).toContainText("Lá♯/Si♭");
    // a nota da vez acende na cor de cada letra (Lá azul, Si roxo), como no "Que nota é essa?"
    const lit = await page
      .getByTestId("notehead")
      .evaluateAll((els) => els.map((e) => e.getAttribute("fill")).filter((f) => f && f !== "#151515"));
    expect(lit).toEqual(["#3b74cc", "#8a52c4"]);
    // lupa: menos notas por linha = maior; lembra no aparelho
    const before = (await state(page)).perRow as number;
    await page.getByRole("button", { name: "Aumentar a partitura" }).click();
    await expect.poll(async () => (await state(page)).perRow).toBeLessThan(before);
    await page.reload();
    await expect.poll(async () => (await state(page)).perRow).toBeLessThan(before);
  });

  test("celular: a nota da vez presa no topo não muda de altura de uma nota para outra", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "a faixa presa no topo só existe no celular");
    await page.goto("/estudos/escala-cromatica");
    const sticky = page.getByTestId("note-sticky");
    for (const id of ["trompete", "trombone", "sax-alto", "clarinete", "flauta-doce"]) {
      await choose(page, id);
      const heights = new Set<number>();
      const count = (await state(page)).count as number;
      for (let i = 0; i < count; i++) {
        heights.add(Math.round((await sticky.boundingBox())!.height));
        await next(page);
      }
      expect([...heights], id).toHaveLength(1);
    }
    // nas escalas também: todas as notas das sete escalas maiores no sax
    await page.goto("/estudos/escalas-maiores");
    await choose(page, "sax-alto");
    const heights = new Set<number>();
    for (const name of ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"]) {
      await page.getByRole("radio", { name: `${name} maior` }).click();
      for (let i = 0; i < 8; i++) {
        heights.add(Math.round((await sticky.boundingBox())!.height));
        await next(page);
      }
    }
    expect([...heights], "escalas").toHaveLength(1);
  });

  test("celular: tocar no diagrama do topo abre a digitação ampliada", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "o diagrama pequeno do topo só existe no celular");
    await page.addInitScript(() =>
      localStorage.setItem("stabat.studies.instrument", JSON.stringify("sax-alto")),
    );
    await page.goto("/estudos/escala-cromatica");
    await page.locator('[data-testid=scale-note][data-note="A#4"]').click();
    const dialog = page.getByTestId("fingering-dialog");
    await expect(dialog).toBeHidden();
    await page.getByTestId("fingering-zoom").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toContainText("Lá♯/Si♭");
    await expect(dialog.locator('[data-key="bis"]')).toHaveAttribute("data-on", "1");
    await expect(dialog).toContainText("esquerda 1 · bis");
    // ampliado de verdade: o diagrama ocupa boa parte da largura da tela
    const w = (await dialog.locator("svg[role=img]").first().boundingBox())!.width;
    expect(w).toBeGreaterThan(200);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // fecha também pelo botão
    await page.getByTestId("fingering-zoom").click();
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("lição que não existe: página não encontrada", async ({ page }) => {
    await page.goto("/estudos/nao-existe");
    await expect(page.getByText(/não encontrad/i).first()).toBeVisible();
  });
});
