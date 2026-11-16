import { test } from "@playwright/test";
import { openLoaded } from "./helpers";

/** capturas para revisão visual: npm run shots → .shots/*.png */
const pages: { name: string; path: string; loaded: boolean; mine?: string }[] = [
  { name: "home", path: "/", loaded: false },
  { name: "arranjo", path: "/apt", loaded: true },
  { name: "arranjo-minha-parte", path: "/apt", loaded: true, mine: "trompete-sib-1" },
  { name: "parte", path: "/apt/trompete-sib-1", loaded: true },
];
const sizes = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "celular", width: 390, height: 844 },
];

for (const s of sizes)
  for (const p of pages)
    test(`${p.name} ${s.name}`, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      if (p.mine)
        await page.addInitScript(
          (id) => localStorage.setItem("stabat.myPart", JSON.stringify({ id, name: id })),
          p.mine,
        );
      if (p.loaded) await openLoaded(page, p.path);
      else {
        await page.goto(p.path);
        await page.getByTestId("arrangement-card").first().waitFor();
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: `.shots/${p.name}-${s.name}.png` });
    });
