/**
 * Miniatura e texto dos links compartilhados (WhatsApp, Telegram, Facebook…). Esses robôs não rodam
 * JavaScript: leem só o HTML. Por isso o build gera uma cópia do index.html com as tags de cada
 * página daqui (vite.config.ts) e o vercel.json aponta o endereço para essa cópia.
 */
export const SITE = "https://stabat.com.br";

export interface ShareMeta {
  /** endereço da página (ex.: /jogos/que-nota) */
  path: string;
  /** arquivo gerado no build, dentro de dist/ */
  file: string;
  title: string;
  description: string;
  /** imagem 1200×630 em public/ */
  image: string;
}

export const SHARE_PAGES: ShareMeta[] = [
  {
    path: "/jogos/que-nota",
    file: "jogos/que-nota.html",
    title: "Que nota é essa? · stabat",
    description:
      "Jogo de leitura de partitura: aparece uma nota na pauta e você toca no nome dela. Fácil para crianças e adultos.",
    image: "/og/que-nota.png",
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** troca título, descrição e as tags Open Graph do index.html pelas da página */
export function injectMeta(html: string, m: ShareMeta): string {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="stabat" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:url" content="${SITE}${m.path}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:image" content="${SITE}${m.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(m.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ");
  return html
    .replace(/[ \t]*<meta\s+property="og:[^"]*"[\s\S]*?\/>\n?/g, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${esc(m.description)}" />`,
    )
    .replace("</head>", `    ${tags}\n  </head>`);
}
