import { test } from "@playwright/test";
import { openPlayer } from "./helpers";
import quartet from "../public/arranjos/quarteto/index.json" with { type: "json" };

/** capturas para revisão visual: npm run shots → .shots/*.png */
const pages: {
  name: string;
  path: string;
  loaded: boolean;
  mine?: string;
  open?: string;
  desktopOnly?: boolean;
}[] = [
  { name: "home", path: "/", loaded: false },
  { name: "home-seletor", path: "/", loaded: false, mine: "trompete-sib-1", open: "#mypart" },
  { name: "arranjo", path: "/apt", loaded: true },
  { name: "arranjo-minha-parte", path: "/apt", loaded: true, mine: "trompete-sib-1" },
  {
    name: "arranjo-imprimir",
    path: "/apt",
    loaded: true,
    open: "[data-testid=print-open]",
    desktopOnly: true,
  },
  { name: "parte", path: "/apt/trompete-sib-1", loaded: true },
  { name: "parte-seletor", path: "/apt/trompete-sib-1", loaded: true, open: "#switch" },
  { name: "calendario", path: "/calendario", loaded: false },
  { name: "quarteto", path: "/quarteto", loaded: false },
  { name: "menu", path: "/jogos/que-nota", loaded: false, open: "[aria-label=Menu]" },
  { name: "jogo-inicio", path: "/jogos/que-nota", loaded: false },
  { name: "jogo", path: "/jogos/que-nota", loaded: false, open: "text=Começar" },
];
/** o que esperar antes da captura, nas páginas sem partitura */
const ready = (path: string) =>
  path === "/calendario"
    ? "evento"
    : path.startsWith("/jogos")
      ? "game-stage"
      : path === "/quarteto" && !quartet.length
        ? "empty-repertoire"
        : "arrangement-card";
const sizes = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "celular", width: 390, height: 844 },
];

for (const s of sizes)
  for (const p of pages.filter((p) => !(p.desktopOnly && s.name === "celular")))
    test(`${p.name} ${s.name}`, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      if (p.mine)
        await page.addInitScript(
          (id) => localStorage.setItem("stabat.myPart", JSON.stringify({ id, name: id })),
          p.mine,
        );
      if (p.loaded) await openPlayer(page, p.path);
      else {
        await page.goto(p.path);
        await page.getByTestId(ready(p.path)).first().waitFor();
      }
      if (p.open) await page.locator(p.open).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `.shots/${p.name}-${s.name}.png` });
    });
