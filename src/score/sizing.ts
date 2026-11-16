/** Tamanho da partitura por largura de tela. */
export interface ScaleSteps {
  phone: number; // < 480 px
  tablet: number; // < 700 px
  desktop: number;
}
export const PART_SCALE: ScaleSteps = { phone: 31, tablet: 34, desktop: 42 };
export const SCORE_SCALE: ScaleSteps = { phone: 24, tablet: 26, desktop: 30 };
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
export const PHONE_MAX = 700;

export function scaleFor(width: number, steps: ScaleSteps, zoom = 1): number {
  const base = width < 480 ? steps.phone : width < PHONE_MAX ? steps.tablet : steps.desktop;
  return Math.round(base * zoom);
}

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 10) / 10));
}

/** No celular: espaçamento mais justo e margens estreitas = mais compassos por linha. */
export function layoutFor(width: number): Record<string, number> {
  return width < PHONE_MAX
    ? { spacingLinear: 0.18, spacingNonLinear: 0.5, pageMarginLeft: 8, pageMarginRight: 8, pageMarginTop: 24 }
    : {};
}

/** Tira a abreviação do instrumento ("Tpt. 1"): o nome aparece só no 1º sistema. */
export function stripAbbreviations(xml: string): string {
  return xml.replace(
    /<part-abbreviation(-display)?>[\s\S]*?<\/part-abbreviation(-display)?>|<part-abbreviation\s*\/>/g,
    "",
  );
}
