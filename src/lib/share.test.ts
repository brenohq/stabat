import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import vercelRaw from "../../vercel.json?raw";
import { injectMeta, SHARE_PAGES } from "./share";

describe("links compartilhados", () => {
  const game = SHARE_PAGES.find((p) => p.path === "/jogos/que-nota")!;

  it("a página do jogo leva título, descrição e imagem próprios", () => {
    const html = injectMeta(indexHtml, game);
    expect(html).toContain("<title>Que nota é essa? · stabat</title>");
    expect(html).toContain('<meta property="og:image" content="https://stabat.com.br/og/que-nota.png" />');
    expect(html).toContain('<meta property="og:url" content="https://stabat.com.br/jogos/que-nota" />');
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).not.toContain("Repertório da banda");
    expect(html).toContain("Jogo de leitura de partitura");
    expect(html).toContain('<div id="root"></div>'); // continua sendo o app
  });

  it("o jogo de ritmo também, e toda página tem imagem e reescrita no vercel.json", () => {
    const rhythm = SHARE_PAGES.find((p) => p.path === "/jogos/ritmo")!;
    const html = injectMeta(indexHtml, rhythm);
    expect(html).toContain("<title>Bate o ritmo · stabat</title>");
    expect(html).toContain('<meta property="og:image" content="https://stabat.com.br/og/ritmo.png" />');
    const images = Object.keys(import.meta.glob("../../public/og/*.png"));
    const vercel = JSON.parse(vercelRaw) as {
      rewrites: { source: string; destination: string }[];
    };
    const generic = vercel.rewrites.findIndex((r) => r.destination === "/index.html");
    for (const p of SHARE_PAGES) {
      expect(images).toContain(`../../public${p.image}`);
      const i = vercel.rewrites.findIndex((r) => r.source === p.path && r.destination === `/${p.file}`);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(generic); // antes da genérica
    }
  });
});
